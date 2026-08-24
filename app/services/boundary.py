"""Safe, idempotent import of the supplied official Delhi boundary."""

import json
import logging
from pathlib import Path

from shapely.geometry import shape
from shapely.ops import unary_union
from sqlalchemy import text

from app.config import PROJECT_ROOT, settings
from app.database import engine

logger = logging.getLogger(__name__)

BOUNDARY_FILENAME = "delhi_boundary.geojson"


def boundary_path() -> Path:
    return Path(settings.raw_data_dir) / BOUNDARY_FILENAME


def _read_boundary(path: Path):
    with path.open("r", encoding="utf-8") as fh:
        document = json.load(fh)

    if document.get("type") == "FeatureCollection":
        geometries = [
            shape(feature["geometry"])
            for feature in document.get("features", [])
            if feature.get("geometry")
        ]
        if not geometries:
            raise ValueError("boundary FeatureCollection contains no geometry")
        geometry = unary_union(geometries)
    elif document.get("type") == "Feature":
        geometry = shape(document["geometry"])
    else:
        geometry = shape(document)

    if geometry.is_empty or not geometry.is_valid:
        raise ValueError("boundary geometry is empty or invalid")
    return geometry


def ensure_boundary() -> bool:
    """Insert the official boundary only when the table is currently empty.

    Existing boundary rows are never replaced. This makes application startup
    safe for a populated database while still wiring the supplied source into
    a fresh database automatically.
    """
    path = boundary_path()
    if not path.is_file():
        logger.warning("boundary source missing: %s", path)
        return False

    geometry = _read_boundary(path)
    with engine.begin() as conn:
        count = conn.execute(text("SELECT count(*) FROM delhi_boundary")).scalar_one()
        if count:
            return False
        conn.execute(
            text(
                "INSERT INTO delhi_boundary (boundary_id, geom, source) "
                "VALUES (1, ST_SetSRID(ST_GeomFromWKB(:wkb), 4326), :source)"
            ),
            {"wkb": geometry.wkb, "source": str(path.relative_to(PROJECT_ROOT))
             if path.is_relative_to(PROJECT_ROOT) else str(path)},
        )
    logger.info("Imported official Delhi boundary from %s", path)
    return True
