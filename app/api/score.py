from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import UrbanGridMaster
from app.schemas import ScoreInput
from app.ml.predict import ModelArtifactError, predict_scores

router = APIRouter(prefix="/score", tags=["score"])


@router.post("/predict", response_model=dict)
def predict(inputs: ScoreInput):
    """ML inference: raw grid metrics -> predicted scores + usability class."""
    try:
        result = predict_scores(inputs)
    except ModelArtifactError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=503, detail="Machine-learning inference is disabled")
    return result


@router.post("/recompute/{grid_id}", response_model=dict)
def recompute_grid_score(grid_id: int, db: Session = Depends(get_db)):
    from app.services.score_calculator import compute_scores_for_grid
    from app.models import SCORE_COLUMNS

    grid = db.get(UrbanGridMaster, grid_id)
    if grid is None:
        raise HTTPException(status_code=404, detail="Grid not found")
    scores = compute_scores_for_grid(db, grid_id)
    return {col: getattr(scores, col) for col in SCORE_COLUMNS}