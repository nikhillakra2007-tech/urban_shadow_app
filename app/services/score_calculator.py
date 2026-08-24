"""Compute the 11 scores + usability class for a grid cell.

Reads each metric from its GROUP table (joined by grid_id), normalises to
0-100 (higher = better), then writes one row into urban_scores.
"""

import logging

from sqlalchemy.orm import Session

from app.models import (
    Air,
    Buildings,
    Commercial,
    Drainage,
    EssentialServices,
    Green,
    Heat,
    Night,
    Population,
    PublicTransport,
    Roads,
    Terrain,
    Traffic,
    UrbanGridMaster,
    UrbanScore,
    Vehicles,
    Vegetation,
    Walkability,
    Water,
    Weather,
)

logger = logging.getLogger(__name__)


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def _val(*xs: float | None) -> float:
    vals = [x for x in xs if x is not None]
    return sum(vals) / len(vals) if vals else 0.0


def compute_scores_for_grid(db: Session, grid_id: int) -> UrbanScore:
    grid = db.get(UrbanGridMaster, grid_id)
    if grid is None:
        raise ValueError(f"grid {grid_id} not found")

    h = grid.heat or Heat(grid_id=grid_id)
    v = grid.vegetation or Vegetation(grid_id=grid_id)
    w = grid.weather or Weather(grid_id=grid_id)
    t = grid.terrain or Terrain(grid_id=grid_id)
    a = grid.air or Air(grid_id=grid_id)
    p = grid.population or Population(grid_id=grid_id)
    n = grid.night or Night(grid_id=grid_id)
    wa = grid.water or Water(grid_id=grid_id)
    r = grid.roads or Roads(grid_id=grid_id)
    tr = grid.traffic or Traffic(grid_id=grid_id)
    ve = grid.vehicles or Vehicles(grid_id=grid_id)
    wlk = grid.walkability or Walkability(grid_id=grid_id)
    b = grid.buildings or Buildings(grid_id=grid_id)
    g = grid.green or Green(grid_id=grid_id)
    d = grid.drainage or Drainage(grid_id=grid_id)
    pt = grid.public_transport or PublicTransport(grid_id=grid_id)
    es = grid.essential_services or EssentialServices(grid_id=grid_id)
    c = grid.commercial or Commercial(grid_id=grid_id)

    # heat: lower LST = better (~30-55 C range)
    heat_score = 100.0 * (1.0 - _clamp01((_val(h.lst_mean) - 30.0) / 30.0))

    # walkability
    walk_raw = (
        (wlk.footway_length_km or 0)
        + (wlk.cycleway_length_km or 0)
        + 0.05 * (wlk.crossing_count or 0)
        + 100 * (wlk.pedestrian_area_km2 or 0)
        + 0.01 * (wlk.steps_count or 0)
    )
    walkability_score = 100.0 * _clamp01(walk_raw / 15.0)

    # traffic: more signals/intersections/roads = worse
    traffic_load = (
        (tr.traffic_signal_count or 0) * 2
        + (r.intersection_count or 0) * 0.5
        + (r.major_road_length_km or 0) * 10
    )
    traffic_score = 100.0 * (1.0 - _clamp01(traffic_load / 60.0))

    # flood: more rainfall + water = worse; drains help
    flood_risk = (
        (w.annual_rainfall or 0) / 2500.0
        + (w.max_monsoon_rainfall or 0) / 300.0
        + (wa.water_occurrence or 0) / 100.0
        + (wa.surface_water_occurrence or 0) / 100.0
    ) - (d.drain_length_km or 0) / 20.0
    flood_score = 100.0 * (1.0 - _clamp01(flood_risk))

    # air: higher pollutants = worse
    air_load = (
        (a.pm25 or 0) / 250.0
        + (a.pm10 or 0) / 400.0
        + (a.no2 or 0) / 80.0
        + (a.o3 or 0) / 120.0
    ) / 4.0
    air_quality_score = 100.0 * (1.0 - _clamp01(air_load))

    # accessibility: roads + intersections + parking + fuel
    access_raw = (
        (r.road_length_km or 0) * 3
        + (r.intersection_count or 0) * 0.3
        + (ve.parking_count or 0) * 0.5
        + (ve.fuel_station_count or 0) * 2
    )
    accessibility_score = 100.0 * _clamp01(access_raw / 40.0)

    # transit
    transit_raw = (
        (pt.bus_stop_count or 0)
        + (pt.metro_station_count or 0) * 5
        + (pt.transit_count or 0)
    )
    transit_score = 100.0 * _clamp01(transit_raw / 30.0)

    # services
    services_raw = (
        (es.hospital_count or 0) * 5
        + (es.school_count or 0) * 3
        + (es.pharmacy_count or 0) * 2
        + (es.police_count or 0) * 2
        + (es.public_toilet_count or 0)
    )
    services_score = 100.0 * _clamp01(services_raw / 30.0)

    # environment: vegetation + parks
    env_raw = (v.ndvi_mean or 0) + (g.park_area_km2 or 0) * 10
    environment_score = 100.0 * _clamp01(env_raw / 1.2)

    # usability: weighted blend (weights sum to 1)
    urban_usability_score = (
        0.15 * heat_score
        + 0.10 * walkability_score
        + 0.10 * traffic_score
        + 0.10 * flood_score
        + 0.10 * air_quality_score
        + 0.10 * accessibility_score
        + 0.10 * transit_score
        + 0.10 * services_score
        + 0.15 * environment_score
    )

    usability_class = classify(urban_usability_score)

    scores = grid.scores or UrbanScore(grid_id=grid_id)
    scores.heat_score = round(heat_score, 2)
    scores.walkability_score = round(walkability_score, 2)
    scores.traffic_score = round(traffic_score, 2)
    scores.flood_score = round(flood_score, 2)
    scores.air_quality_score = round(air_quality_score, 2)
    scores.accessibility_score = round(accessibility_score, 2)
    scores.transit_score = round(transit_score, 2)
    scores.services_score = round(services_score, 2)
    scores.environment_score = round(environment_score, 2)
    scores.urban_usability_score = round(urban_usability_score, 2)
    scores.usability_class = usability_class

    db.add(scores)
    db.commit()
    logger.info("Computed scores for grid %s -> %s (%.2f)", grid_id, usability_class, urban_usability_score)
    return scores


def classify(score: float) -> str:
    if score >= 75:
        return "High Usability"
    if score >= 50:
        return "Moderate Usability"
    if score >= 25:
        return "Low Usability"
    return "Very Low Usability"


def compute_all_scores(db: Session) -> int:
    grid_ids = [g.grid_id for g in db.query(UrbanGridMaster).all()]
    for gid in grid_ids:
        compute_scores_for_grid(db, gid)
    logger.info("Computed scores for all %d grids", len(grid_ids))
    return len(grid_ids)