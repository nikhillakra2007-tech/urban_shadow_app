from fastapi import APIRouter

from app.api import dashboard, grids, score

api_router = APIRouter()
api_router.include_router(grids.router)
api_router.include_router(score.router)
api_router.include_router(dashboard.router)