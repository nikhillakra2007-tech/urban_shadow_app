import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import UrbanGridMaster, UrbanScore
from app.schemas import GridBundleOut, GridSummary

router = APIRouter(prefix="/grids", tags=["grids"])

_GROUP_ATTRS = [
    "heat", "vegetation", "weather", "terrain", "air", "population", "night",
    "water", "roads", "traffic", "vehicles", "walkability", "buildings", "green",
    "drainage", "public_transport", "essential_services", "commercial", "scores",
]

GridId = Annotated[int, Path(ge=1, le=10_000_000)]


@router.get("", response_model=list[GridSummary])
def list_grids(
    page: Annotated[int, Query(ge=1, le=100_000)] = 1,
    per_page: Annotated[int, Query(ge=1, le=1_000)] = 100,
    usability_class: Annotated[str | None, Query(max_length=30)] = None,
    db: Session = Depends(get_db),
):
    query = select(UrbanGridMaster)
    if usability_class:
        query = query.join(UrbanScore).where(UrbanScore.usability_class == usability_class)
    rows = db.execute(query.order_by(UrbanGridMaster.grid_id)
                      .offset((page - 1) * per_page).limit(per_page)).scalars().all()
    return [
        GridSummary(
            grid_id=g.grid_id,
            latitude=g.latitude,
            longitude=g.longitude,
            usability_class=g.scores.usability_class if g.scores else None,
            urban_usability_score=g.scores.urban_usability_score if g.scores else None,
        )
        for g in rows
    ]


@router.get("/{grid_id}/bundle", response_model=GridBundleOut)
def get_grid_bundle(grid_id: GridId, db: Session = Depends(get_db)):
    """Everything for one grid cell: all 18 metric groups + scores."""
    grid = db.execute(
        select(UrbanGridMaster)
        .options(*[selectinload(getattr(UrbanGridMaster, attr)) for attr in _GROUP_ATTRS])
        .where(UrbanGridMaster.grid_id == grid_id)
    ).scalar_one_or_none()
    if grid is None:
        raise HTTPException(status_code=404, detail="Grid cell not found")

    data = {
        "grid_id": grid.grid_id,
        "latitude": grid.latitude,
        "longitude": grid.longitude,
    }
    for attr in _GROUP_ATTRS:
        data[attr] = getattr(grid, attr)
    return GridBundleOut(**data)


@router.get("/{grid_id}/scores", response_model=dict)
def get_grid_scores(grid_id: GridId, db: Session = Depends(get_db)):
    grid = db.get(UrbanGridMaster, grid_id)
    if grid is None:
        raise HTTPException(status_code=404, detail="Grid cell not found")
    scores = grid.scores
    if scores is None:
        return {"grid_id": grid_id, "scores": None}
    return {
        "grid_id": grid_id,
        "scores": {
            "heat_score": scores.heat_score,
            "walkability_score": scores.walkability_score,
            "traffic_score": scores.traffic_score,
            "flood_score": scores.flood_score,
            "air_quality_score": scores.air_quality_score,
            "accessibility_score": scores.accessibility_score,
            "transit_score": scores.transit_score,
            "services_score": scores.services_score,
            "environment_score": scores.environment_score,
            "urban_usability_score": scores.urban_usability_score,
            "usability_class": scores.usability_class,
        },
    }


@router.get("/{grid_id}/geojson")
def get_grid_geojson(grid_id: GridId, db: Session = Depends(get_db)):
    """Return one valid GeoJSON feature in EPSG:4326."""
    row = db.execute(
        text(
            "SELECT g.grid_id, g.latitude, g.longitude, "
            "ST_AsGeoJSON(ST_Transform(g.geom, 4326)) AS geojson, "
            "s.urban_usability_score, s.usability_class "
            "FROM urban_grid_master g "
            "LEFT JOIN urban_scores s ON s.grid_id = g.grid_id "
            "WHERE g.grid_id = :grid_id"
        ),
        {"grid_id": grid_id},
    ).mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Grid cell not found")
    if not row["geojson"]:
        raise HTTPException(status_code=500, detail="Grid geometry is unavailable")

    return {
        "type": "Feature",
        "properties": {
            "grid_id": row["grid_id"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "urban_usability_score": row["urban_usability_score"],
            "usability_class": row["usability_class"],
        },
        "geometry": json.loads(row["geojson"]),
    }
