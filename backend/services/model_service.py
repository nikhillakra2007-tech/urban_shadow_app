import joblib
import json
import os
import numpy as np
import pandas as pd

class ModelService:
    def __init__(self):
        base = os.path.dirname(os.path.dirname(__file__))
        self.model = joblib.load(os.path.join(base, "model", "uus_model.pkl"))
        with open(os.path.join(base, "model", "feature_columns.json"), "r") as f:
            self.features: list[str] = json.load(f)

    def predict(self, feature_vector: pd.DataFrame) -> float:
        """
        Predict UUS score for the given feature vector.
        Strictly enforces feature order from feature_columns.json.
        Raises ValueError if required features are missing.
        """
        missing = [f for f in self.features if f not in feature_vector.columns]
        if missing:
            raise ValueError(f"Missing required features: {missing}")
        X = feature_vector[self.features].astype(float)
        return float(self.model.predict(X)[0])

    def get_feature_importances(self) -> dict[str, float]:
        """
        Returns global XGBoost feature importances (gain-based), sorted descending.
        These are GLOBAL importances — not per-grid SHAP contributions.
        """
        try:
            fi = self.model.feature_importances_
            return dict(
                sorted(
                    zip(self.features, [float(v) for v in fi]),
                    key=lambda x: x[1],
                    reverse=True,
                )
            )
        except AttributeError:
            return {}