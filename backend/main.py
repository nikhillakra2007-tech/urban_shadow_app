import os
import math
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from services.grid_service import GridService
from services.model_service import ModelService
from services.analytics_service import AnalyticsService
from services.simulation_engine import SimulationEngine
from services.recommendation_service import RecommendationService
from schemas.api_models import SimulationRequest

app = FastAPI(
    title="UUS Delhi Intelligence API",
    description=(
        "Urban Utility Score (UUS) backend for Delhi. "
        "Provides grid-level scores, geospatial data, analytics, "
        "what-if simulation, and AI-driven recommendations based on "
        "an XGBoost regression model trained on 36 urban indicators."
    ),
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow both local development and the deployed Render frontend.
origins = os.getenv(
    "ALLOWED_ORIGINS",
    ",".join([
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://urban-shadow-frontend.onrender.com",
    ]),
).split(",")

origins = [origin.strip().rstrip("/") for origin in origins if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Service Init (loaded ONCE at startup) ─────────────────────────────────────
_model_error: str | None = None
_data_error: str | None = None

try:
    ms = ModelService()
except Exception as e:
    ms = None  # type: ignore[assignment]
    _model_error = str(e)

try:
    gs = GridService()
    # CRITICAL: uus_score is not in the raw CSV; compute it from the model now
    if ms is not None:
        gs.set_uus_scores(ms)
except Exception as e:
    gs = None  # type: ignore[assignment]
    _data_error = str(e)

sim = SimulationEngine(ms, gs) if (ms is not None and gs is not None) else None
ans = AnalyticsService(gs) if gs is not None else None
rec = RecommendationService(gs, ms) if (gs is not None and ms is not None) else None


# ── Health ────────────────────────────────────────────────────────────────────
@app.get(
    "/api/health",
    summary="Health check",
    description="Returns operational status. model_loaded and dataset_loaded reflect actual state.",
    tags=["System"],
)
def health():
    return {
        "status": "ok" if (_model_error is None and _data_error is None) else "degraded",
        "model_loaded": ms is not None,
        "dataset_loaded": gs is not None and getattr(gs, "_uus_computed", False),
        "model_error": _model_error,
        "data_error": _data_error,
    }


# ── Overview ──────────────────────────────────────────────────────────────────
@app.get(
    "/api/overview",
    summary="Dataset overview",
    description="Aggregate statistics computed live from the real Delhi dataset.",
    tags=["Analytics"],
)
def overview():
    if ans is None:
        raise HTTPException(503, detail=f"Service unavailable: {_data_error or _model_error}")
    return ans.get_overview()


# ── All Grids ─────────────────────────────────────────────────────────────────
@app.get(
    "/api/grids",
    summary="List all grids",
    description="Paginated list of Delhi grid records (grid_id, lat, lon, uus_score, classification).",
    tags=["Grids"],
)
def list_grids(limit: int = 100, offset: int = 0):
    if gs is None:
        raise HTTPException(503, detail=f"Dataset unavailable: {_data_error}")
    return gs.get_all_grids(limit=limit, offset=offset)


# ── GeoJSON — MUST come before /api/grids/{grid_id} ──────────────────────────
@app.get(
    "/api/grids/geojson",
    summary="GeoJSON FeatureCollection",
    description=(
        "All Delhi grids as a GeoJSON FeatureCollection. "
        "Geometry: Point [longitude, latitude]. "
        "Properties: grid_id, uus_score, classification."
    ),
    tags=["Grids"],
)
def geojson():
    if gs is None:
        raise HTTPException(503, detail=f"Dataset unavailable: {_data_error}")
    return gs.get_geojson()


# ── Grid cells (polygons) ─────────────────────────────────────────────────────
@app.get(
    "/api/grids/cells",
    summary="Grid cell polygons",
    description=(
        "All Delhi 500 m grid CELLS as polygon GeoJSON joined with scores. "
        "Geometry: Polygon [longitude, latitude] (WGS-84). "
        "Properties: grid_id, uus_score, classification."
    ),
    tags=["Grids"],
)
def grid_cells():
    if gs is None:
        raise HTTPException(503, detail=f"Dataset unavailable: {_data_error}")
    return gs.get_cells_geojson()


# ── Single Grid ───────────────────────────────────────────────────────────────
@app.get(
    "/api/grids/{grid_id}",
    summary="Single grid detail",
    description="Full record for one grid including all 46 dataset columns + uus_score + classification.",
    tags=["Grids"],
)
def get_grid(grid_id: str):
    if gs is None:
        raise HTTPException(503, detail=f"Dataset unavailable: {_data_error}")
    res = gs.get_grid(grid_id)
    if not res:
        raise HTTPException(404, detail=f"Grid '{grid_id}' not found.")
    return res


# ── Grid Explanation ─────────────────────────────────────────────────────────
@app.get(
    "/api/grids/{grid_id}/explanation",
    summary="Grid score explanation",
    description=(
        "Returns global XGBoost feature importances (gain-based). "
        "IMPORTANT: these are *global* importances across all grids, "
        "NOT per-grid SHAP contributions."
    ),
    tags=["Grids"],
)
def explain_grid(grid_id: str):
    if gs is None:
        raise HTTPException(503, detail=f"Dataset unavailable: {_data_error}")
    if ms is None:
        raise HTTPException(503, detail=f"Model unavailable: {_model_error}")

    grid = gs.get_grid(grid_id)

    if not grid:
        raise HTTPException(404, detail=f"Grid '{grid_id}' not found.")

    importances = ms.get_feature_importances()

    return {
        "grid_id": grid_id,
        "uus_score": grid.get("uus_score"),
        "classification": grid.get("classification"),
        "explainability_method": "Global Feature Importance (XGBoost gain-based)",
        "note": (
            "These importances show which features the model relies on most across ALL grids — "
            "they do NOT explain the specific score for this individual grid. "
            "Per-grid explanations require SHAP, which is not currently configured."
        ),
        "global_feature_importances": importances,
    }


# ── Rankings ─────────────────────────────────────────────────────────────────
@app.get(
    "/api/rankings",
    summary="Top and bottom grids by UUS score",
    description="Top-N highest and bottom-N lowest UUS-scored Delhi grids.",
    tags=["Analytics"],
)
def rankings(limit: int = 10):
    if ans is None:
        raise HTTPException(503, detail=f"Service unavailable: {_data_error or _model_error}")
    return ans.get_rankings(limit=limit)


# ── Analytics ────────────────────────────────────────────────────────────────
@app.get(
    "/api/analytics",
    summary="Full analytics report",
    description="UUS distribution, classification breakdown, indicator stats, feature importances.",
    tags=["Analytics"],
)
def analytics():
    if ans is None:
        raise HTTPException(503, detail=f"Service unavailable: {_data_error or _model_error}")

    fi = ms.get_feature_importances() if ms is not None else {}

    return ans.get_analytics(feature_importances=fi)


# ── AI Suggestions ───────────────────────────────────────────────────────────
@app.post(
    "/api/ai-suggestions",
    summary="Data-driven improvement suggestions",
    description=(
        "Returns deterministic recommendations based on actual indicator values. "
        "No external LLM is used."
    ),
    tags=["Recommendations"],
)
def ai_suggestions(body: dict = Body(..., examples=[{"grid_id": "DEL_00001"}])):
    grid_id = body.get("grid_id")

    if not grid_id:
        raise HTTPException(422, detail="Request body must include 'grid_id'.")

    if rec is None:
        raise HTTPException(503, detail="Recommendation service unavailable.")

    if gs is None:
        raise HTTPException(503, detail=f"Dataset unavailable: {_data_error}")

    grid = gs.get_grid(str(grid_id))

    if not grid:
        raise HTTPException(404, detail=f"Grid '{grid_id}' not found.")

    suggestions = rec.get_suggestions(str(grid_id))

    return {
        "grid_id": grid_id,
        "uus_score": grid.get("uus_score"),
        "classification": grid.get("classification"),
        "methodology": (
            "Deterministic rule-based engine using real indicator thresholds. "
            "No external LLM is configured or called."
        ),
        "suggestions": suggestions,
    }


# ── What-If Simulation ───────────────────────────────────────────────────────
@app.post(
    "/api/simulate",
    summary="What-if simulation",
    description=(
        "Modifies one or more of the 36 model features for the specified grid and "
        "re-runs the XGBoost model. Only features in feature_columns.json are accepted. "
        "Returns baseline UUS, simulated UUS, and the delta."
    ),
    tags=["Simulation"],
)
def simulate(req: SimulationRequest):
    if sim is None:
        raise HTTPException(503, detail="Simulation service unavailable.")

    result = sim.run(req.grid_id, req.changes)

    if not result.get("supported", True):
        raise HTTPException(
            422,
            detail={
                "error": result.get("reason"),
                "unsupported_changes": result.get("unsupported_changes", []),
            },
        )

    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
    )
