# UUS Delhi — Urban Shadow

Grid-level urban usability / sustainability intelligence for Delhi NCR.
A 500 m grid (6,284 cells) scored by a trained XGBoost model over 36 urban
indicators (healthcare, education, transit, air quality, heat, vegetation,
water, population …), served by FastAPI and visualised in a Next.js +
MapLibre dashboard with what-if simulation and rule-based recommendations.

```
DATA (backend/data/delhi_final_dataset.csv)
   └─> FastAPI services (grid / analytics / simulation / recommendations)
         └─> XGBoost model (backend/model/uus_model.pkl, 36 features)
               └─> REST API (/api/*)
                     └─> Next.js dashboard (map, rankings, analytics,
                         compare, dossier, what-if simulator)
```

## Repository layout

```
urban/
├── backend/
│   ├── main.py                  # FastAPI app + routes (/api/health, /api/overview,
│   │                            #   /api/grids[/geojson|/{id}|/{id}/explanation],
│   │                            #   /api/rankings, /api/analytics,
│   │                            #   POST /api/ai-suggestions, POST /api/simulate)
│   ├── schemas/api_models.py    # Pydantic request/response models
│   ├── services/                # grid_service, model_service, analytics_service,
│   │                            #   simulation_engine, recommendation_service
│   ├── model/                   # uus_model.pkl (XGBRegressor) + feature_columns.json
│   │                            #   (36 features — the inference contract)
│   ├── data/delhi_final_dataset.csv   # 6,284 rows — the single source of truth
│   └── requirements.txt
├── frontend/                    # Next.js 16 App Router + TypeScript + Tailwind v4
│   ├── app/                     # routes: / (map), /rankings, /analytics,
│   │                            #   /compare, /reports, /settings
│   ├── components/              # map (MapLibre), panel (dossier/simulator), views, ui
│   ├── lib/                     # api.ts (single fetch point), types.ts, uus.ts,
│   │                            #   hooks.ts (SWR), app-state.tsx
│   └── package.json
├── data/raw sources             # *.gpkg / *.tif-era OSM & satellite inputs kept
│                                #   out of Git (large); curated dataset ships in backend/data
├── render.yaml                  # Render blueprint (backend + frontend)
├── .env.example                 # backend env template (names only)
└── .gitignore
```

`grid_id` (e.g. `DEL_03263`) is the primary key linking every record; the CSV
row set matches the original 500 m Delhi grid exactly.

## Score & classification

- `uus_score` = raw prediction of the delivered `XGBRegressor`
  (100 trees, depth 6). The training script was not part of the handoff, so
  the score lives on the model's trained scale — the UI scales colour bands
  against the real observed min/max from `/api/overview`.
- Classification tiers (`Critical / Low / Moderate / Good / Excellent`) use
  equal quintiles of the observed range — the same rule the frontend applies
  (`frontend/lib/uus.ts -> bandForScore`).

## Run locally (PowerShell)

### 1. Backend

```powershell
cd backend
python -m venv ..\.venv
..\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# Swagger: http://127.0.0.1:8000/docs
```

> Requires **xgboost 2.x** (pinned in requirements.txt) — the shipped model
> artifact cannot be deserialised by xgboost 3.x.

### 2. Frontend

```powershell
cd frontend
npm install
copy .env.example .env.local      # defaults to http://localhost:8000
npm run dev                       # http://localhost:3000
```

Production build instead of dev:

```powershell
npm run build
npm run start
```

## Deploy on Render

The repo includes `render.yaml` (blueprint). Two web services are created:

| Service     | Root dir  | Build                      | Start                                        | Health        |
|-------------|-----------|----------------------------|----------------------------------------------|---------------|
| backend     | `backend` | `pip install -r requirements.txt` | `uvicorn main:app --host 0.0.0.0 --port $PORT` | `/api/health` |
| frontend    | `frontend`| `npm ci && npm run build`  | `npm run start`                              | `/`           |

After creating the services set:

1. Backend env `ALLOWED_ORIGINS` → your frontend URL (CORS).
2. Frontend env `NEXT_PUBLIC_API_URL` → your backend URL.
   (`NEXT_PUBLIC_*` is baked at build time — set it before the frontend build.)

## Data provenance

Raw OpenStreetMap extracts, satellite rasters and CPCB sensor data were
aggregated per 500 m grid cell into `backend/data/delhi_final_dataset.csv`.
The upstream GeoPackage/GeoJSON sources remain available out-of-repo for
regeneration; no runtime component reads them.
