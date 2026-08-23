from app.models.boundary import DelhiBoundary
from app.models.grid import UrbanGridMaster
from app.models.groups import (
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
    Vegetation,
    Vehicles,
    Walkability,
    Water,
    Weather,
)
from app.models.score import SCORE_COLUMNS, UrbanScore

__all__ = [
    "DelhiBoundary",
    "UrbanGridMaster",
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
    "UrbanScore",
    "SCORE_COLUMNS",
]

# group model -> its feature columns (order matters: matches the ML feature vector)
GROUP_FEATURES: dict[str, list[str]] = {
    "heat": ["lst_mean", "lst_summer_mean"],
    "vegetation": ["ndvi_mean", "builtup_percentage"],
    "weather": ["humidity", "wind_speed", "annual_rainfall", "max_day_rainfall", "max_monsoon_rainfall"],
    "terrain": ["elevation_mean", "elevation_min", "elevation_max"],
    "air": ["pm25", "pm10", "no2", "o3"],
    "population": ["population", "population_density"],
    "night": ["nightlight_mean"],
    "water": ["water_occurrence", "surface_water_occurrence"],
    "roads": ["road_length_km", "major_road_length_km", "intersection_count"],
    "traffic": ["traffic_signal_count"],
    "vehicles": ["parking_count", "fuel_station_count"],
    "walkability": ["footway_length_km", "cycleway_length_km", "crossing_count", "pedestrian_area_km2", "steps_count"],
    "buildings": ["building_count", "building_area_km2"],
    "green": ["park_area_km2"],
    "drainage": ["drain_length_km"],
    "public_transport": ["bus_stop_count", "metro_station_count", "transit_count"],
    "essential_services": ["hospital_count", "school_count", "pharmacy_count", "police_count", "public_toilet_count"],
    "commercial": ["commercial_area_km2", "industrial_area_km2", "retail_area_km2"],
}

FEATURE_COLUMNS: list[str] = [
    col for cols in GROUP_FEATURES.values() for col in cols
]