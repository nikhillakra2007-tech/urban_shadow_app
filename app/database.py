import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, pool_pre_ping=True, echo=settings.debug)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def enable_postgis() -> None:
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Ensure the existing schema and the boundary integration are present."""
    enable_postgis()
    import app.models  # noqa: F401  (register all models)

    Base.metadata.create_all(bind=engine)

    # Boundary import is deliberately insert-only: startup must not replace
    # an existing official boundary or touch the populated grid tables.
    try:
        from app.services.boundary import ensure_boundary

        ensure_boundary()
    except Exception as exc:
        logger.warning("Delhi boundary was not imported: %s", exc)


def database_status() -> dict:
    """Return safe readiness details without exposing connection credentials."""
    try:
        with engine.connect() as conn:
            postgis = conn.execute(text("SELECT PostGIS_Version()")).scalar_one()
            grid_cells = conn.execute(text("SELECT count(*) FROM urban_grid_master")).scalar_one()
            boundary_rows = conn.execute(text("SELECT count(*) FROM delhi_boundary")).scalar_one()
        return {
            "connected": True,
            "postgis": str(postgis),
            "grid_cells": int(grid_cells),
            "boundary_rows": int(boundary_rows),
        }
    except Exception:
        return {
            "connected": False,
            "postgis": None,
            "grid_cells": None,
            "boundary_rows": None,
        }
