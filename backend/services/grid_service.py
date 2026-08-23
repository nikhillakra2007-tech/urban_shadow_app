import pandas as pd
import numpy as np
import os
import json


def classify_uus(score: float, score_min: float = 0.0, score_max: float = 100.0) -> str:
    """Map a UUS score to its human-readable classification tier.

    The delivered XGBoost artifact predicts on its own trained scale (the
    training script was not part of the handoff), so absolute 0-100 cutoffs
    would place every real prediction in one bucket. Tiers are therefore
    positioned against the observed dataset range using the SAME equal-quintile
    rule the frontend applies when no class string exists
    (frontend/lib/uus.ts -> bandForScore).
    """
    span = (score_max - score_min) or 1.0
    t = min(1.0, max(0.0, (score - score_min) / span))
    if t < 0.2:
        return "Critical"
    elif t < 0.4:
        return "Low"
    elif t < 0.6:
        return "Moderate"
    elif t < 0.8:
        return "Good"
    else:
        return "Excellent"


class GridService:
    def __init__(self):
        base = os.path.dirname(os.path.dirname(__file__))
        csv_path = os.path.join(base, "data", "delhi_final_dataset.csv")
        self.df = pd.read_csv(csv_path)

        # Load feature columns to know which 36 columns feed the model
        feat_path = os.path.join(base, "model", "feature_columns.json")
        with open(feat_path) as f:
            self._model_features: list[str] = json.load(f)

        # Ensure grid_id is always a string
        if "grid_id" in self.df.columns:
            self.df["grid_id"] = self.df["grid_id"].astype(str)

        # uus_score is NOT in the raw CSV — compute it now using the model
        # (model itself is injected via set_model_service after init, or computed
        #  in init if passed in — see set_uus_scores method called from main.py)
        self._uus_computed = False

    def set_uus_scores(self, model_service) -> None:
        """
        Compute UUS scores for all grids using the actual trained model.
        Called once at startup from main.py after both services are initialized.
        """
        X = self.df[self._model_features].astype(float)
        preds = model_service.model.predict(X)
        self.df["uus_score"] = preds.astype(float)
        self._score_min = float(self.df["uus_score"].min())
        self._score_max = float(self.df["uus_score"].max())
        self.df["classification"] = self.df["uus_score"].apply(
            lambda s: classify_uus(float(s), self._score_min, self._score_max)
        )
        self._uus_computed = True

    def _clean_record(self, record: dict) -> dict:
        """Replace NaN / Inf with None so JSON serialization never breaks."""
        cleaned = {}
        for k, v in record.items():
            try:
                if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
                    cleaned[k] = None
                elif isinstance(v, (np.integer,)):
                    cleaned[k] = int(v)
                elif isinstance(v, (np.floating,)):
                    cleaned[k] = float(v)
                else:
                    cleaned[k] = v
            except Exception:
                cleaned[k] = None
        return cleaned

    def get_all_grids(self, limit: int = 100, offset: int = 0) -> list[dict]:
        """Return a paginated list of grid summaries (key columns only)."""
        cols = ["grid_id", "latitude", "longitude", "uus_score", "classification"]
        available = [c for c in cols if c in self.df.columns]
        subset = self.df[available].iloc[offset : offset + limit]
        return [self._clean_record(r) for r in subset.to_dict(orient="records")]

    def get_grid(self, grid_id: str) -> dict | None:
        """Return the full record for a single grid, or None if not found."""
        match = self.df[self.df["grid_id"] == str(grid_id)]
        if match.empty:
            return None
        return self._clean_record(match.iloc[0].to_dict())

    def get_geojson(self) -> dict:
        """
        Returns a GeoJSON FeatureCollection.
        Geometry: Point [longitude, latitude] (WGS-84 / EPSG:4326).
        Properties: grid_id, uus_score (rounded 2dp), classification.
        NOTE: The dataset contains point centroids, not polygon boundaries.
        """
        features = []
        for _, r in self.df.iterrows():
            uus_raw = r.get("uus_score", None)
            uus_val = (
                None
                if (uus_raw is None or (isinstance(uus_raw, float) and np.isnan(uus_raw)))
                else round(float(uus_raw), 2)
            )
            features.append({
                "type": "Feature",
                "id": str(r["grid_id"]),
                "properties": {
                    "grid_id": str(r["grid_id"]),
                    "uus_score": uus_val,
                    "classification": r.get("classification"),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(r["longitude"]), float(r["latitude"])],
                },
            })
        return {"type": "FeatureCollection", "features": features}