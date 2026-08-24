from pydantic import BaseModel, ConfigDict

from app.models import FEATURE_COLUMNS


class GridSummary(BaseModel):
    grid_id: int
    latitude: float
    longitude: float
    usability_class: str | None = None
    urban_usability_score: float | None = None


class ScoreInput(BaseModel):
    """Raw grid metrics fed to the ML model -> predicted scores + usability class.

    Same flat shape as before (the model vector is built by reading each
    group's columns in GROUP_FEATURES order).
    """

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    lst_mean: float = 0.0
    lst_summer_mean: float = 0.0
    ndvi_mean: float = 0.0
    builtup_percentage: float = 0.0
    humidity: float = 0.0
    wind_speed: float = 0.0
    annual_rainfall: float = 0.0
    max_day_rainfall: float = 0.0
    max_monsoon_rainfall: float = 0.0
    elevation_mean: float = 0.0
    elevation_min: float = 0.0
    elevation_max: float = 0.0
    pm25: float = 0.0
    pm10: float = 0.0
    no2: float = 0.0
    o3: float = 0.0
    population: float = 0.0
    population_density: float = 0.0
    nightlight_mean: float = 0.0
    water_occurrence: float = 0.0
    surface_water_occurrence: float = 0.0
    road_length_km: float = 0.0
    major_road_length_km: float = 0.0
    intersection_count: float = 0.0
    traffic_signal_count: float = 0.0
    parking_count: float = 0.0
    fuel_station_count: float = 0.0
    footway_length_km: float = 0.0
    cycleway_length_km: float = 0.0
    crossing_count: float = 0.0
    pedestrian_area_km2: float = 0.0
    steps_count: float = 0.0
    building_count: float = 0.0
    building_area_km2: float = 0.0
    park_area_km2: float = 0.0
    drain_length_km: float = 0.0
    bus_stop_count: float = 0.0
    metro_station_count: float = 0.0
    transit_count: float = 0.0
    hospital_count: float = 0.0
    school_count: float = 0.0
    pharmacy_count: float = 0.0
    police_count: float = 0.0
    public_toilet_count: float = 0.0
    commercial_area_km2: float = 0.0
    industrial_area_km2: float = 0.0
    retail_area_km2: float = 0.0

    @classmethod
    def feature_names(cls) -> list[str]:
        return FEATURE_COLUMNS