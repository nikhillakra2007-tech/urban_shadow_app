from pydantic import BaseModel, ConfigDict

from app.models import GROUP_FEATURES, SCORE_COLUMNS
from app.schemas.score import ScoreInput


def _build_group_models():
    """Generate a Pydantic model per group table from GROUP_FEATURES."""
    schemas: dict[str, type[BaseModel]] = {}
    for group, cols in GROUP_FEATURES.items():
        annotations: dict[str, type] = {"grid_id": int}
        defaults: dict[str, object] = {}
        for c in cols:
            annotations[c] = float | None
            defaults[c] = None
        annotations["__annotations__"] = annotations
        defaults["model_config"] = ConfigDict(from_attributes=True)
        defaults["__annotations__"] = annotations
        schemas[group] = type(f"Group{group.title()}", (BaseModel,), defaults)
    return schemas


GroupSchemas: dict[str, type[BaseModel]] = _build_group_models()

# Explicit named classes for clarity/typing
Heat = GroupSchemas["heat"]
Vegetation = GroupSchemas["vegetation"]
Weather = GroupSchemas["weather"]
Terrain = GroupSchemas["terrain"]
Air = GroupSchemas["air"]
Population = GroupSchemas["population"]
Night = GroupSchemas["night"]
Water = GroupSchemas["water"]
Roads = GroupSchemas["roads"]
Traffic = GroupSchemas["traffic"]
Vehicles = GroupSchemas["vehicles"]
Walkability = GroupSchemas["walkability"]
Buildings = GroupSchemas["buildings"]
Green = GroupSchemas["green"]
Drainage = GroupSchemas["drainage"]
PublicTransport = GroupSchemas["public_transport"]
EssentialServices = GroupSchemas["essential_services"]
Commercial = GroupSchemas["commercial"]


class ScoresOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    grid_id: int
    heat_score: float | None = None
    walkability_score: float | None = None
    traffic_score: float | None = None
    flood_score: float | None = None
    air_quality_score: float | None = None
    accessibility_score: float | None = None
    transit_score: float | None = None
    services_score: float | None = None
    environment_score: float | None = None
    urban_usability_score: float | None = None
    usability_class: str | None = None


class GridBundleOut(BaseModel):
    """The full picture for one grid cell - all groups + scores resolved by grid_id."""

    grid_id: int
    latitude: float
    longitude: float
    heat: Heat | None = None
    vegetation: Vegetation | None = None
    weather: Weather | None = None
    terrain: Terrain | None = None
    air: Air | None = None
    population: Population | None = None
    night: Night | None = None
    water: Water | None = None
    roads: Roads | None = None
    traffic: Traffic | None = None
    vehicles: Vehicles | None = None
    walkability: Walkability | None = None
    buildings: Buildings | None = None
    green: Green | None = None
    drainage: Drainage | None = None
    public_transport: PublicTransport | None = None
    essential_services: EssentialServices | None = None
    commercial: Commercial | None = None
    scores: ScoresOut | None = None


__all__ = [
    "GroupSchemas",
    "Heat",
    "Vegetation",
    "Weather",
    "Terrain",
    "Air",
    "Population",
    "Night",
    "Water",
    "Roads",
    "Traffic",
    "Vehicles",
    "Walkability",
    "Buildings",
    "Green",
    "Drainage",
    "PublicTransport",
    "EssentialServices",
    "Commercial",
    "ScoresOut",
    "GridBundleOut",
]