"""Generate the 500m x 500m grid and insert rows into urban_grid_master."""

import logging

from geoalchemy2.shape import to_shape
from pyproj import Transformer
from shapely.geometry import box
from shapely.ops import transform
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models import UrbanGridMaster

logger = logging.getLogger(__name__)

CELL_SIZE_M = 500.0
WEB_MERCATOR = 3857
_TO_WGS84 = Transformer.from_crs(WEB_MERCATOR, 4326, always_xy=True)


def load_boundary_geom(db: Session):
    row = db.execute(
        text(
            "SELECT ST_AsBinary(ST_Transform(geom, 3857)) AS geom_3857 "
            "FROM delhi_boundary ORDER BY boundary_id LIMIT 1"
        )
    ).first()
    if row is None:
        raise RuntimeError("delhi_boundary is empty - import the official NCT Delhi polygon first.")
    from shapely.wkb import loads

    return loads(bytes(row.geom_3857))


def _mercator_to_lonlat(x: float, y: float) -> tuple[float, float]:
    return _TO_WGS84.transform(x, y)


def generate_cells(db: Session, cell_size_m: float = CELL_SIZE_M) -> int:
    """Generate cells only for an empty hub; never duplicate existing cells."""
    existing = db.execute(select(func.count()).select_from(UrbanGridMaster)).scalar_one()
    if existing:
        logger.info("Skipped grid generation; urban_grid_master already has %d rows", existing)
        return 0

    boundary = load_boundary_geom(db)
    minx, miny, maxx, maxy = boundary.bounds

    start_x = int(minx // cell_size_m) * cell_size_m
    start_y = int(miny // cell_size_m) * cell_size_m

    rows: list[UrbanGridMaster] = []
    y = start_y
    while y < maxy:
        x = start_x
        while x < maxx:
            cell = box(x, y, x + cell_size_m, y + cell_size_m)
            if cell.intersects(boundary):
                cx, cy = cell.centroid.x, cell.centroid.y
                lng, lat = _mercator_to_lonlat(cx, cy)
                rows.append(
                    UrbanGridMaster(
                        geom=f"SRID={WEB_MERCATOR};{cell.wkb_hex}",
                        latitude=round(lat, 6),
                        longitude=round(lng, 6),
                    )
                )
            x += cell_size_m
        y += cell_size_m

    db.add_all(rows)
    db.commit()
    logger.info("Inserted %d grid cells (500m) into urban_grid_master", len(rows))
    return len(rows)


def grid_geojson_feature(grid: UrbanGridMaster) -> dict:
    """Serialize a grid row as GeoJSON in WGS84 coordinates."""
    geom = transform(_TO_WGS84.transform, to_shape(grid.geom))
    scores = grid.scores
    return {
        "type": "Feature",
        "properties": {
            "grid_id": grid.grid_id,
            "latitude": grid.latitude,
            "longitude": grid.longitude,
            "usability_class": scores.usability_class if scores else None,
            "urban_usability_score": scores.urban_usability_score if scores else None,
        },
        "geometry": geom.__geo_interface__,
    }


def grid_geojson_collection(db: Session) -> dict:
    rows = db.execute(select(UrbanGridMaster).order_by(UrbanGridMaster.grid_id)).scalars().all()
    return {
        "type": "FeatureCollection",
        "features": [grid_geojson_feature(g) for g in rows],
    }
