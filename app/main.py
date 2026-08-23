import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.config import settings

logger = logging.getLogger(__name__)

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from app.database import init_db

        init_db()
        logger.info("Database schema and boundary integration are ready")
    except Exception as exc:  # DB not created yet -> warn, don't crash the server
        logger.warning("DB not ready yet (%s). Create the database in pgAdmin4, then restart.", exc)
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "Urban shadow scoring platform for NCT Delhi. "
        "One urban_grid_master row per 500m cell: all metric groups + computed scores."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.get("/health", tags=["health"])
def health():
    from app.database import database_status
    from app.ml.predict import model_status

    database = database_status()
    model = model_status()
    ready = database["connected"] and (not settings.ml_enabled or model["available"])
    return {
        "status": "ok" if ready else "degraded",
        "app": settings.app_name,
        "ml_enabled": settings.ml_enabled,
        "database": database,
        "model": model,
    }