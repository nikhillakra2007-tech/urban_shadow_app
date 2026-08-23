-- urban_shadow_v2 bootstrap (normalized: GRID + one table per group)
-- Run in pgAdmin4 against your PostgreSQL database (creates DB objects only
-- if you prefer SQL over SQLAlchemy create_all; the app also self-provisions).

-- Create the database once (if not already done):
--   CREATE DATABASE urban_shadow_v2;

CREATE EXTENSION IF NOT EXISTS postgis;

-- AUTHORITATIVE DELHI BOUNDARY (one source polygon for optional grid generation)
CREATE TABLE IF NOT EXISTS delhi_boundary (
    boundary_id INTEGER PRIMARY KEY,
    geom        geometry(GEOMETRY, 4326) NOT NULL,
    source      VARCHAR(255) NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delhi_boundary_geom ON delhi_boundary USING GIST (geom);

-- GRID - master table (hub). Every other table links here via grid_id.
CREATE TABLE IF NOT EXISTS urban_grid_master (
    grid_id   SERIAL PRIMARY KEY,
    geom      geometry(GEOMETRY, 3857) NOT NULL,
    latitude  FLOAT NOT NULL,
    longitude FLOAT NOT NULL
);

-- HEAT
CREATE TABLE IF NOT EXISTS heat (
    grid_id         INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    lst_mean        FLOAT,
    lst_summer_mean FLOAT
);

-- VEGETATION
CREATE TABLE IF NOT EXISTS vegetation (
    grid_id            INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    ndvi_mean          FLOAT,
    builtup_percentage FLOAT,
    landcover_class    VARCHAR(50)
);

-- WEATHER
CREATE TABLE IF NOT EXISTS weather (
    grid_id            INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    humidity           FLOAT,
    wind_speed         FLOAT,
    annual_rainfall    FLOAT,
    max_day_rainfall   FLOAT,
    max_monsoon_rainfall FLOAT
);

-- TERRAIN
CREATE TABLE IF NOT EXISTS terrain (
    grid_id       INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    elevation_mean FLOAT,
    elevation_min  FLOAT,
    elevation_max  FLOAT
);

-- AIR
CREATE TABLE IF NOT EXISTS air (
    grid_id INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    pm25    FLOAT,
    pm10    FLOAT,
    no2     FLOAT,
    o3      FLOAT
);

-- POPULATION
CREATE TABLE IF NOT EXISTS population (
    grid_id            INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    population         FLOAT,
    population_density FLOAT
);

-- NIGHT
CREATE TABLE IF NOT EXISTS night (
    grid_id         INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    nightlight_mean FLOAT
);

-- WATER
CREATE TABLE IF NOT EXISTS water (
    grid_id                   INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    water_occurrence          FLOAT,
    surface_water_occurrence  FLOAT
);

-- ROADS
CREATE TABLE IF NOT EXISTS roads (
    grid_id              INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    road_length_km       FLOAT,
    major_road_length_km FLOAT,
    intersection_count   FLOAT
);

-- TRAFFIC
CREATE TABLE IF NOT EXISTS traffic (
    grid_id             INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    traffic_signal_count FLOAT
);

-- VEHICLES
CREATE TABLE IF NOT EXISTS vehicles (
    grid_id            INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    parking_count      FLOAT,
    fuel_station_count FLOAT
);

-- WALKABILITY
CREATE TABLE IF NOT EXISTS walkability (
    grid_id             INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    footway_length_km   FLOAT,
    cycleway_length_km  FLOAT,
    crossing_count      FLOAT,
    pedestrian_area_km2 FLOAT,
    steps_count         FLOAT
);

-- BUILDINGS
CREATE TABLE IF NOT EXISTS buildings (
    grid_id           INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    building_count    FLOAT,
    building_area_km2 FLOAT
);

-- GREEN
CREATE TABLE IF NOT EXISTS green (
    grid_id      INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    park_area_km2 FLOAT
);

-- DRAINAGE
CREATE TABLE IF NOT EXISTS drainage (
    grid_id        INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    drain_length_km FLOAT
);

-- PUBLIC TRANSPORT
CREATE TABLE IF NOT EXISTS public_transport (
    grid_id             INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    bus_stop_count      FLOAT,
    metro_station_count FLOAT,
    transit_count       FLOAT
);

-- ESSENTIAL SERVICES
CREATE TABLE IF NOT EXISTS essential_services (
    grid_id              INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    hospital_count       FLOAT,
    school_count         FLOAT,
    pharmacy_count       FLOAT,
    police_count         FLOAT,
    public_toilet_count  FLOAT
);

-- COMMERCIAL
CREATE TABLE IF NOT EXISTS commercial (
    grid_id              INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    commercial_area_km2  FLOAT,
    industrial_area_km2  FLOAT,
    retail_area_km2      FLOAT
);

-- SCORES
CREATE TABLE IF NOT EXISTS urban_scores (
    grid_id               INT PRIMARY KEY REFERENCES urban_grid_master(grid_id),
    heat_score            FLOAT,
    walkability_score     FLOAT,
    traffic_score         FLOAT,
    flood_score           FLOAT,
    air_quality_score     FLOAT,
    accessibility_score   FLOAT,
    transit_score         FLOAT,
    services_score        FLOAT,
    environment_score     FLOAT,
    urban_usability_score FLOAT,
    usability_class       VARCHAR(30)
);
CREATE INDEX IF NOT EXISTS idx_urban_scores_class ON urban_scores (usability_class);
CREATE INDEX IF NOT EXISTS idx_urban_grid_master_geom ON urban_grid_master USING GIST (geom);