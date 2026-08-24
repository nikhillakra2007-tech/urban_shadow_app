## 🌐 Live Demo

[🚀 Open Urban Shadow](https://urban-shadow-frontend.onrender.com)

# urban_shadow

FastAPI platform that scores every 500m × 500m grid cell of NCT Delhi for **urban usability**. Normalized schema: `urban_grid_master` (GRID hub) + **one table per metric group**, all linked by `grid_id`.

```
urban_grid_master (GRID: grid_id, geom, latitude, longitude)
├── heat              (lst_mean, lst_summer_mean)
├── vegetation        (ndvi_mean, builtup_percentage, landcover_class)
├── weather           (humidity, wind_speed, annual_rainfall, max_day_rainfall, max_monsoon_rainfall)
├── terrain           (elevation_mean, elevation_min, elevation_max)
├── air               (pm25, pm10, no2, o3)
├── population        (population, population_density)
├── night             (nightlight_mean)
├── water             (water_occurrence, surface_water_occurrence)
├── roads             (road_length_km, major_road_length_km, intersection_count)
├── traffic           (traffic_signal_count)
├── vehicles          (parking_count, fuel_station_count)
├── walkability       (footway_length_km, cycleway_length_km, crossing_count, pedestrian_area_km2, steps_count)
├── buildings         (building_count, building_area_km2)
├── green             (park_area_km2)
├── drainage          (drain_length_km)
├── public_transport  (bus_stop_count, metro_station_count, transit_count)
├── essential_services(hospital_count, school_count, pharmacy_count, police_count, public_toilet_count)
├── commercial        (commercial_area_km2, industrial_area_km2, retail_area_km2)
└── urban_scores      (heat_score ... urban_usability_score, usability_class)
```

## Structure

```
urban_shadow/
├── app/
│   ├── main.py             # FastAPI app (auto-creates DB + tables on start)
│   ├── config.py           # env-driven settings
│   ├── database.py         # SQLAlchemy engine/session + PostGIS enable
│   ├── models/
│   │   ├── grid.py         # urban_grid_master (GRID hub)
│   │   ├── groups.py       # 18 group tables
│   │   └── score.py        # urban_scores
│   ├── schemas/
│   │   ├── score.py        # ScoreInput (flat feature vector), GridSummary
│   │   └── bundle.py       # GridBundleOut (grid + all groups + scores)
│   ├── api/
│   │   ├── grids.py        # list / bundle / scores / geojson
│   │   └── score.py        # ML predict + recompute
│   ├── services/
│   │   ├── grid_generator.py   # 500m grid from boundary
│   │   ├── score_calculator.py # 11 scores from group tables
│   │   └── pipeline.py         # grid -> score flow
│   └── ml/
│       ├── features.py     # training frame (joins all groups)
│       ├── train.py        # regressor + classifier
│       └── predict.py      # model inference
├── scripts/
│   ├── init_db.sql         # raw DDL (GRID + 18 groups + scores)
│   ├── drop_old_schema.sql # removes previous schema versions
│   └── grid_bundle_query.sql
├── requirements.txt
├── .env.example
```

## Setup

1. **PostgreSQL + PostGIS** — create the DB in pgAdmin4:
   ```sql
   CREATE DATABASE urban_shadow_v2;
   ```
   (PostGIS + all 20 tables are created automatically by the app on server start.)

2. **Env** — copy `.env.example` to `.env` and fix `DATABASE_URL` with your pgAdmin4 credentials (DB name is `urban_shadow_v2`).

3. **Install & run:**
   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

## Migrating from a previous schema version

If you still have an old `urban_grid_master` (flat 70-column table) or the v1 tables:
1. Run `scripts/drop_old_schema.sql` in pgAdmin4 (drops them in dependency order).
2. Restart the server → the app recreates the normalized schema automatically.

## Generating the grid (needs the Delhi boundary first)

Insert the **official NCT Delhi polygon** into a `delhi_boundary` table (geometry column `geom`, EPSG:4326), then:

```bash
python -m app.services.pipeline   # creates 500m grid rows + scores them
```

## Training the ML model

```bash
python -m app.ml.train
```

- Trains a **RandomForestRegressor** (`urban_usability_score`) + **RandomForestClassifier** (`usability_class`).
- Uses real DB rows; falls back to 3000 synthetic samples so it always runs.
- Saves to `data/models/urban_score_regressor.joblib` + `urban_class_classifier.joblib`.

## API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/grids` | list all grid cells (summary + class) |
| `GET /api/v1/grids/{id}/bundle` | everything for one cell — all 18 groups + scores |
| `GET /api/v1/grids/{id}/scores` | the 11 scores + usability class |
| `GET /api/v1/grids/{id}/geojson` | cell geometry for the map |
| `POST /api/v1/score/predict` | ML prediction from raw metrics |
| `POST /api/v1/score/recompute/{id}` | recompute scores from group tables |
| `GET /health` | server alive check |

## Scoring model (weights)

```
urban_usability_score =
  0.15 heat + 0.10 walkability + 0.10 traffic + 0.10 flood + 0.10 air
  + 0.10 accessibility + 0.10 transit + 0.10 services + 0.15 environment

usability_class:  High Usability (>=75) | Moderate (>=50) | Low (>=25) | Very Low
```
