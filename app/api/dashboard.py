import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import UrbanGridMaster, UrbanScore

router = APIRouter(tags=["dashboard"])


@router.get("/stats")
def dashboard_stats(db: Session = Depends(get_db)):
    total = db.query(UrbanGridMaster).count()
    scored = db.query(UrbanScore).count()
    classes = dict(
        db.query(UrbanScore.usability_class, func.count(UrbanScore.grid_id))
        .group_by(UrbanScore.usability_class)
        .all()
    )
    avg = db.query(func.avg(UrbanScore.urban_usability_score)).scalar()
    best = db.query(UrbanScore).order_by(UrbanScore.urban_usability_score.desc()).first()
    worst = db.query(UrbanScore).order_by(UrbanScore.urban_usability_score.asc()).first()

    def _loc(s):
        g = db.get(UrbanGridMaster, s.grid_id)
        return (g.latitude, g.longitude) if g else (None, None)

    return {
        "total_cells": total,
        "scored_cells": scored,
        "coverage_pct": round(100.0 * scored / total, 1) if total else 0,
        "class_distribution": classes,
        "avg_usability_score": round(float(avg), 2) if avg is not None else None,
        "best": {
            "grid_id": best.grid_id,
            "score": best.urban_usability_score,
            "usability_class": best.usability_class,
            "latitude": _loc(best)[0],
            "longitude": _loc(best)[1],
        }
        if best
        else None,
        "worst": {
            "grid_id": worst.grid_id,
            "score": worst.urban_usability_score,
            "usability_class": worst.usability_class,
            "latitude": _loc(worst)[0],
            "longitude": _loc(worst)[1],
        }
        if worst
        else None,
    }


@router.get("/map")
def grid_map(
    limit: Annotated[int, Query(ge=1, le=10_000)] = 10_000,
    db: Session = Depends(get_db),
):
    """Full grid + scores as GeoJSON FeatureCollection (EPSG:4326)."""
    rows = db.execute(
        text(
            "SELECT g.grid_id, g.latitude, g.longitude, "
            "ST_AsGeoJSON(ST_Transform(g.geom, 4326)) AS geojson, "
            "s.urban_usability_score, s.usability_class "
            "FROM urban_grid_master g LEFT JOIN urban_scores s ON s.grid_id = g.grid_id "
            "ORDER BY g.grid_id LIMIT :lim"
        ),
        {"lim": limit},
    ).mappings().all()

    features = []
    for row in rows:
        if not row["geojson"]:
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "grid_id": row["grid_id"],
                    "latitude": row["latitude"],
                    "longitude": row["longitude"],
                    "urban_usability_score": float(row["urban_usability_score"])
                    if row["urban_usability_score"] is not None
                    else None,
                    "usability_class": row["usability_class"],
                },
                "geometry": json.loads(row["geojson"]),
            }
        )
    return {"type": "FeatureCollection", "features": features}


@router.get("/search")
def search_grids(
    q: Annotated[str, Query(min_length=1, max_length=100)],
    limit: Annotated[int, Query(ge=1, le=100)] = 10,
    db: Session = Depends(get_db),
):
    """Search cells by grid_id or nearest cell to ``lat,lng``."""
    query = q.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Search query cannot be blank")

    if query.isdigit():
        grid_id = int(query)
        if grid_id < 1:
            return []
        g = db.get(UrbanGridMaster, grid_id)
        if not g:
            return []
        s = g.scores
        return [{
            "grid_id": g.grid_id,
            "latitude": g.latitude,
            "longitude": g.longitude,
            "urban_usability_score": s.urban_usability_score if s else None,
            "usability_class": s.usability_class if s else None,
        }]

    if "," not in query:
        raise HTTPException(status_code=422, detail="Use a grid ID or lat,lng")
    parts = [part.strip() for part in query.split(",")]
    if len(parts) != 2:
        raise HTTPException(status_code=422, detail="Coordinates must use lat,lng")
    try:
        lat, lng = (float(part) for part in parts)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Coordinates must be numeric") from exc
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise HTTPException(status_code=422, detail="Coordinates are outside valid bounds")

    rows = db.execute(
        text(
            "SELECT g.grid_id, g.latitude, g.longitude, s.urban_usability_score, s.usability_class "
            "FROM urban_grid_master g LEFT JOIN urban_scores s ON s.grid_id = g.grid_id "
            "ORDER BY g.geom <-> ST_Transform(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), 3857) "
            "LIMIT :lim"
        ),
        {"lng": lng, "lat": lat, "lim": limit},
    ).mappings().all()
    return [dict(row) for row in rows]
