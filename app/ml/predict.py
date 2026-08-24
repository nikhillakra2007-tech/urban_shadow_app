"""Load trained models and predict scores + usability class for a grid."""

import logging
import os
from collections.abc import Mapping

import joblib
import pandas as pd

from app.config import settings
from app.ml.features import FEATURE_COLUMNS
from app.schemas import ScoreInput

logger = logging.getLogger(__name__)


class ModelArtifactError(RuntimeError):
    """Raised when a model artifact is missing or violates the feature contract."""


def _regressor_path() -> str:
    return os.path.join(settings.model_dir, "urban_score_regressor.joblib")


def _classifier_path() -> str:
    return os.path.join(settings.model_dir, "urban_class_classifier.joblib")


def _load(path: str, role: str) -> Mapping:
    if not os.path.isfile(path):
        raise ModelArtifactError(f"{role} artifact is missing")
    try:
        bundle = joblib.load(path)
    except Exception as exc:
        raise ModelArtifactError(f"{role} artifact could not be loaded") from exc
    if not isinstance(bundle, Mapping) or "model" not in bundle:
        raise ModelArtifactError(f"{role} artifact has an invalid bundle format")

    columns = bundle.get("columns")
    if list(columns or []) != FEATURE_COLUMNS:
        raise ModelArtifactError(f"{role} artifact feature columns do not match the API contract")

    model = bundle["model"]
    feature_count = getattr(model, "n_features_in_", None)
    if feature_count is not None and int(feature_count) != len(FEATURE_COLUMNS):
        raise ModelArtifactError(f"{role} artifact expects {feature_count} features, not {len(FEATURE_COLUMNS)}")
    return bundle


def model_status() -> dict:
    """Return model readiness without exposing local paths or artifact contents."""
    if not settings.ml_enabled:
        return {"enabled": False, "available": False, "feature_count": len(FEATURE_COLUMNS), "reason": "disabled"}
    try:
        _load(_regressor_path(), "regressor")
        _load(_classifier_path(), "classifier")
    except ModelArtifactError as exc:
        return {
            "enabled": True,
            "available": False,
            "feature_count": len(FEATURE_COLUMNS),
            "reason": str(exc),
        }
    return {"enabled": True, "available": True, "feature_count": len(FEATURE_COLUMNS), "reason": None}


def predict_scores(inputs: ScoreInput) -> dict | None:
    if not settings.ml_enabled:
        return None
    reg_bundle = _load(_regressor_path(), "regressor")
    clf_bundle = _load(_classifier_path(), "classifier")

    row = pd.DataFrame(
        [[getattr(inputs, col) for col in FEATURE_COLUMNS]],
        columns=FEATURE_COLUMNS,
    )

    try:
        score = float(reg_bundle["model"].predict(row)[0])
        class_ = str(clf_bundle["model"].predict(row)[0])
    except Exception as exc:
        logger.exception("Model inference failed")
        raise ModelArtifactError("model inference failed for the supplied feature vector") from exc
    return {
        "urban_usability_score": round(score, 2),
        "usability_class": class_,
    }
