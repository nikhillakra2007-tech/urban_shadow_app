"""Pipeline orchestration - generate grid, then compute scores."""

import logging

from sqlalchemy.orm import Session

from app.database import init_db, SessionLocal
from app.services.grid_generator import generate_cells
from app.services.score_calculator import compute_all_scores

logger = logging.getLogger(__name__)


def run_pipeline(session: Session | None = None) -> dict:
    init_db()
    db = session or SessionLocal()
    try:
        cells = generate_cells(db)
        scored = compute_all_scores(db)
        return {"grid_cells_created": cells, "grids_scored": scored}
    finally:
        if session is None:
            db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(run_pipeline())