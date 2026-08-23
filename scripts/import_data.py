"""Import all raw Delhi data into the urban_shadow schema.

Inputs (in data/raw/):
  delhi_grid_500m.geojson        -> urban_grid_master (the pre-built 500m grid)
  delhi_grid_elevation.geojson   -> terrain
  *.gpkg  (OSM layers)           -> per-grid counts / lengths / areas  (all group tables)
  *.tif   (rasters)              -> per-grid zonal mean                 (group tables)
  delhi_pm25_pm10_combined.csv   -> air

Every numeric is the value AVERAGED over all grid cells (6284).
"""

import argparse
import json
import logging
import os
import sys
import warnings

warnings.filterwarnings("ignore")

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import shape
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings  # noqa: E402
from app.database import SessionLocal, init_db  # noqa: E402

logger = logging.getLogger("urban_shadow.import_data")

RAW = settings.raw_data_dir
GRID_FILE = os.path.join(RAW, "delhi_grid_500m.geojson")
ELEV_FILE = os.path.join(RAW, "delhi_grid_elevation.geojson")
PM_CSV = os.path.join(RAW, "delhi_pm25_pm10_combined.csv")

# UTM zone 43N covers Delhi -> metres, good for area/length
METRIC_CRS = "EPSG:32643"


# ---------------------------------------------------------------- helpers


def load_grid():
    gdf = gpd.read_file(GRID_FILE)
    gdf = gdf.to_crs(METRIC_CRS)
    # DB grid_id (serial, inserted in file order) == row index + 1
    gdf["db_id"] = [i + 1 for i in range(len(gdf))]
    return gdf  # columns: grid_id (code), db_id, longitude, latitude, geometry


def sum_by_grid(features: gpd.GeoDataFrame, grid: gpd.GeoDataFrame):
    """Spatial-join features to grid cells; return db grid_id -> dict of aggregates.

    For points: count.
    For lines:  count + length_km.
    For polygons: count + area_km2.
    """
    feat = features.to_crs(METRIC_CRS)
    joined = gpd.sjoin(feat, grid[["db_id", "geometry"]], how="inner", predicate="intersects")

    rows = {}
    for gid, grp in joined.groupby("db_id"):
        entry = {"count": len(grp)}
        if grp.geometry.type.str.startswith("Line").any():
            entry["length_km"] = round(float(grp.geometry.length.sum()) / 1000.0, 6)
        if grp.geometry.type.str.startswith("Polygon").any():
            entry["area_km2"] = round(float(grp.geometry.area.sum()) / 1_000_000.0, 6)
        rows[int(gid)] = entry
    return rows


def raster_mean(tif_path: str, grid: gpd.GeoDataFrame) -> dict[int, float]:
    from rasterstats import zonal_stats

    gdf = grid.to_crs("EPSG:4326")
    stats = zonal_stats(
        gdf,
        tif_path,
        stats=["mean"],
        nodata=None,
        all_touched=False,
    )
    return {int(gid): round(float(st["mean"]), 6) if st["mean"] is not None else None
            for gid, st in zip(gdf["db_id"], stats)}


def to_db(table: str, values: dict[int, dict], accumulate: bool = False):
    """values: grid_id -> {column: value}. Upserts into group table (grid_id PK).

    accumulate=True: values are ADDED to any existing row (used when multiple
    source files contribute to the same table).
    """
    if not values:
        return
    db = SessionLocal()
    try:
        for gid, data in values.items():
            cols = list(data)
            placeholders = ", ".join(":" + c for c in cols)
            if accumulate:
                sets = ", ".join(f"{c} = COALESCE({table}.{c}, 0) + EXCLUDED.{c}" for c in cols)
            else:
                sets = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols)
            params = {c: data[c] for c in cols}
            params["grid_id"] = gid
            db.execute(
                text(
                    f"INSERT INTO {table} (grid_id, {', '.join(cols)}) "
                    f"VALUES (:grid_id, {placeholders}) "
                    f"ON CONFLICT (grid_id) DO UPDATE SET {sets}"
                ),
                params,
            )
        db.commit()
        logger.info("Imported %d rows -> %s", len(values), table)
    finally:
        db.close()


# ---------------------------------------------------------------- importers


def import_grid_and_terrain(replace_grid: bool = False):
    """Load the official grid without deleting existing rows by default."""
    grid = load_grid()
    grid3857 = grid.to_crs("EPSG:3857")
    db = SessionLocal()
    try:
        existing = db.execute(text("SELECT count(*) FROM urban_grid_master")).scalar_one()
        if existing and not replace_grid:
            rows = db.execute(
                text(
                    "SELECT grid_id, latitude, longitude FROM urban_grid_master "
                    "ORDER BY grid_id"
                )
            ).mappings().all()
            if len(rows) != len(grid):
                raise RuntimeError(
                    f"existing grid has {len(rows)} rows but source has {len(grid)}; "
                    "use --replace-grid only after verifying the source"
                )
            for expected_id, (row, (_, source)) in enumerate(zip(rows, grid.iterrows()), start=1):
                if row["grid_id"] != expected_id or abs(row["latitude"] - float(source["latitude"])) > 1e-5 or abs(row["longitude"] - float(source["longitude"])) > 1e-5:
                    raise RuntimeError(
                        "existing grid IDs/coordinates do not match the official source; "
                        "refusing to guess a mapping"
                    )
            logger.info("Existing grid matches the official source; no grid rows changed")
        else:
            if existing:
                logger.warning("--replace-grid requested; truncating the grid and dependent metric rows")
                db.execute(text("TRUNCATE urban_grid_master RESTART IDENTITY CASCADE"))
            for _, row in grid3857.iterrows():
                db.execute(
                    text(
                        "INSERT INTO urban_grid_master (geom, latitude, longitude) "
                        "VALUES (ST_SetSRID(ST_GeomFromWKB(:wkb), 3857), :lat, :lng)"
                    ),
                    {
                        "wkb": row.geometry.wkb,
                        "lat": float(row["latitude"]),
                        "lng": float(row["longitude"]),
                    },
                )
            db.commit()
            logger.info("Inserted %d grid cells into urban_grid_master", len(grid))

        # grid_code (DEL_00001) -> canonical db grid_id (source order is checked above)
        grid_codes = list(grid["grid_id"].astype(str))
        code_to_id = {code: i + 1 for i, code in enumerate(grid_codes)}

        if not os.path.exists(ELEV_FILE):
            logger.warning("missing %s - terrain skipped", ELEV_FILE)
            return grid, code_to_id
        elev = gpd.read_file(ELEV_FILE)
        terrain: dict[int, dict] = {}
        for _, r in elev.iterrows():
            gid = code_to_id.get(str(r["grid_id"]))
            if gid is None:
                continue
            terrain[gid] = {
                "elevation_mean": float(r.get("elevation_mean") or 0),
                "elevation_min": float(r.get("elevation_min") or 0),
                "elevation_max": float(r.get("elevation_max") or 0),
            }
        to_db("terrain", terrain)
        return grid, code_to_id
    finally:
        db.close()


def import_vector_layers(grid: gpd.GeoDataFrame):
    # fname -> (table, [(column, kind)]): kind in {count, length_km, area_km2}
    mappings = {
        "delhi_benches.gpkg": ("walkability", [("steps_count", "count")]),
        "delhi_buildings.gpkg": ("buildings", [("building_count", "count"), ("building_area_km2", "area_km2")]),
        "delhi_bus_stations.gpkg": ("public_transport", [("bus_stop_count", "count")]),
        "delhi_bus_stops.gpkg": ("public_transport", [("bus_stop_count", "count")]),
        "delhi_commercial.gpkg": ("commercial", [("commercial_area_km2", "area_km2")]),
        "delhi_crossings.gpkg": ("walkability", [("crossing_count", "count")]),
        "delhi_cycleways.gpkg": ("walkability", [("cycleway_length_km", "length_km")]),
        "delhi_forests.gpkg": ("green", [("park_area_km2", "area_km2")]),
        "delhi_footways.gpkg": ("walkability", [("footway_length_km", "length_km")]),
        "delhi_grass.gpkg": ("green", [("park_area_km2", "area_km2")]),
        "delhi_hospitals.gpkg": ("essential_services", [("hospital_count", "count")]),
        "delhi_industrial.gpkg": ("commercial", [("industrial_area_km2", "area_km2")]),
        "delhi_metro.gpkg": ("public_transport", [("metro_station_count", "count")]),
        "delhi_parking.gpkg": ("vehicles", [("parking_count", "count")]),
        "delhi_parks.gpkg": ("green", [("park_area_km2", "area_km2")]),
        "delhi_pedestrian_areas.gpkg": ("walkability", [("pedestrian_area_km2", "area_km2")]),
        "delhi_pharmacies.gpkg": ("essential_services", [("pharmacy_count", "count")]),
        "delhi_police.gpkg": ("essential_services", [("police_count", "count")]),
        "delhi_public_transport_stops.gpkg": ("public_transport", [("transit_count", "count")]),
        "delhi_railway_stations.gpkg": ("public_transport", [("transit_count", "count")]),
        "delhi_retail.gpkg": ("commercial", [("retail_area_km2", "area_km2")]),
        "delhi_roads.gpkg": ("roads", [("road_length_km", "length_km"), ("intersection_count", "count")]),
        "delhi_schools.gpkg": ("essential_services", [("school_count", "count")]),
        "delhi_steps.gpkg": ("walkability", [("steps_count", "count")]),
        "delhi_street_lights.gpkg": ("walkability", [("steps_count", "count")]),
        "delhi_subway_entrances.gpkg": ("public_transport", [("transit_count", "count")]),
        "delhi_toilets.gpkg": ("essential_services", [("public_toilet_count", "count")]),
        "delhi_traffic_signals.gpkg": ("traffic", [("traffic_signal_count", "count")]),
    }

    # Aggregate all source files in memory, then overwrite each touched column.
    # This keeps repeated imports idempotent instead of adding counts again.
    combined: dict[str, dict[int, dict[str, float]]] = {}
    for fname, (table, targets) in mappings.items():
        path = os.path.join(RAW, fname)
        if not os.path.exists(path):
            logger.warning("missing %s - skipped", fname)
            continue
        try:
            feats = gpd.read_file(path)
        except Exception as e:
            logger.warning("could not read %s: %s", fname, e)
            continue
        if feats.empty:
            logger.info("%s is empty - skipped", fname)
            continue

        per_grid = sum_by_grid(feats, grid)
        table_rows = combined.setdefault(table, {})
        for gid, entry in per_grid.items():
            row = table_rows.setdefault(int(gid), {})
            for col, kind in targets:
                if kind == "count":
                    value = float(entry["count"])
                elif kind == "length_km":
                    value = float(entry.get("length_km", 0))
                else:
                    value = float(entry.get("area_km2", 0))
                row[col] = row.get(col, 0.0) + value
        logger.info("%s -> %d grids touched", fname, len(per_grid))

    for table, values in combined.items():
        to_db(table, values, accumulate=False)


def import_rasters(grid: gpd.GeoDataFrame):
    # (file, table, column, optional scale factor)
    raster_map = [
        ("delhi_lst_2024.tif", "heat", "lst_mean"),
        ("delhi_lst_summer_2024.tif", "heat", "lst_summer_mean"),
        ("delhi_ndvi_2024.tif", "vegetation", "ndvi_mean"),
        ("delhi_builtup_2024.tif", "vegetation", "builtup_percentage"),
        ("delhi_humidity_2024.tif", "weather", "humidity"),
        ("delhi_wind_2024.tif", "weather", "wind_speed"),
        ("delhi_average_annual_rainfall.tif", "weather", "annual_rainfall"),
        ("delhi_max_1day_rainfall.tif", "weather", "max_day_rainfall"),
        ("delhi_monsoon_rainfall.tif", "weather", "max_monsoon_rainfall"),
        ("delhi_population_worldpop.tif", "population", "population"),
        ("delhi_nightlights_2024.tif", "night", "nightlight_mean"),
        ("delhi_water_occurrence.tif", "water", "water_occurrence"),
        ("delhi_surface_water_occurrence.tif", "water", "surface_water_occurrence"),
        ("delhi_no2_2024.tif", "air", "no2"),
        ("delhi_o3_2024.tif", "air", "o3"),
    ]

    # batch per table so we do one upsert per raster column
    for fname, table, col in raster_map:
        path = os.path.join(RAW, fname)
        if not os.path.exists(path):
            logger.warning("missing %s - skipped", fname)
            continue
        try:
            means = raster_mean(path, grid)
        except Exception as e:
            logger.warning("raster %s failed: %s", fname, e)
            continue
        to_db(table, {gid: {col: v} for gid, v in means.items() if v is not None})
        logger.info("%s -> %s.%s", fname, table, col)


def import_air_pm():
    if not os.path.exists(PM_CSV):
        logger.warning("missing %s - skipped", PM_CSV)
        return
    df = pd.read_csv(PM_CSV)
    logger.info("PM CSV columns: %s | rows: %d", list(df.columns), len(df))
    # expect columns like lat, lng/longitude, pm25, pm10 (possibly timestamped)
    lat_col = next((c for c in df.columns if c.lower() in ("lat", "latitude")), None)
    lng_col = next((c for c in df.columns if c.lower() in ("lng", "lon", "longitude")), None)
    if lat_col is None or lng_col is None:
        logger.warning("PM CSV missing lat/lng columns - skipped")
        return

    grid_latlon = gpd.read_file(GRID_FILE)
    grid_latlon["db_id"] = [i + 1 for i in range(len(grid_latlon))]
    pts = gpd.GeoDataFrame(
        df[[lat_col, lng_col]],
        geometry=gpd.points_from_xy(df[lng_col], df[lat_col]),
        crs="EPSG:4326",
    )
    pts["pm25"] = pd.to_numeric(df.get("pm25", df.get("PM25")), errors="coerce") if "pm25" in df.columns or "PM25" in df.columns else np.nan
    pts["pm10"] = pd.to_numeric(df.get("pm10", df.get("PM10")), errors="coerce") if "pm10" in df.columns or "PM10" in df.columns else np.nan

    joined = gpd.sjoin(pts.to_crs(METRIC_CRS), grid_latlon.to_crs(METRIC_CRS), how="inner", predicate="intersects")
    air = {}
    for gid, grp in joined.groupby("db_id"):
        vals = {"pm25": float(grp["pm25"].mean()), "pm10": float(grp["pm10"].mean())}
        vals = {k: (round(v, 6) if pd.notna(v) else None) for k, v in vals.items()}
        air[int(gid)] = vals
    to_db("air", air)


# ---------------------------------------------------------------- main


def run(replace_grid: bool = False):
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    init_db()
    grid, _ = import_grid_and_terrain(replace_grid=replace_grid)
    import_vector_layers(grid)
    import_rasters(grid)
    import_air_pm()
    logger.info("IMPORT COMPLETE")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--replace-grid",
        action="store_true",
        help="explicitly replace the existing grid and dependent metric rows",
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    run(replace_grid=args.replace_grid)