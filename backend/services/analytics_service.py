import pandas as pd
import numpy as np

# Tier order used for reporting; values come from GridService classification.
TIER_ORDER = ["Critical", "Low", "Moderate", "Good", "Excellent"]


class AnalyticsService:
    def __init__(self, grid_service):
        self.gs = grid_service

    def get_overview(self) -> dict:
        df = self.gs.df
        scores = df["uus_score"]
        counts = df["classification"].value_counts().to_dict()
        return {
            "total_grids": int(len(df)),
            "avg_uus": round(float(scores.mean()), 4),
            "min_uus": round(float(scores.min()), 4),
            "max_uus": round(float(scores.max()), 4),
            "classification_counts": {tier: int(counts.get(tier, 0)) for tier in TIER_ORDER},
        }

    def get_rankings(self, limit: int = 10) -> dict:
        df = self.gs.df
        cols = ["grid_id", "area_name", "uus_score", "classification"]
        top = (
            df.nlargest(limit, "uus_score")[cols]
            .to_dict(orient="records")
        )
        bottom = (
            df.nsmallest(limit, "uus_score")[cols]
            .to_dict(orient="records")
        )
        return {"top_grids": top, "bottom_grids": bottom}

    def get_analytics(self, feature_importances: dict | None = None) -> dict:
        df = self.gs.df
        scores = df["uus_score"]

        # UUS distribution (10 bins)
        hist, bin_edges = np.histogram(scores, bins=10)
        distribution = [
            {
                "range": f"{bin_edges[i]:.1f}–{bin_edges[i+1]:.1f}",
                "count": int(hist[i]),
            }
            for i in range(len(hist))
        ]

        # Classification distribution
        class_counts = df["classification"].value_counts().to_dict()

        # Indicator statistics for numeric columns (excl. lat/lon and model internals)
        skip_cols = {"grid_id", "latitude", "longitude", "uus_score", "classification"}
        indicator_cols = [c for c in df.columns if c not in skip_cols and pd.api.types.is_numeric_dtype(df[c])]
        indicator_stats = {}
        for col in indicator_cols:
            s = df[col].dropna()
            if len(s) == 0:
                continue
            indicator_stats[col] = {
                "mean":  round(float(s.mean()), 4),
                "min":   round(float(s.min()), 4),
                "max":   round(float(s.max()), 4),
                "std":   round(float(s.std()), 4),
            }

        # Top and bottom 5 grids
        cols = ["grid_id", "area_name", "uus_score", "classification"]
        top5 = df.nlargest(5, "uus_score")[cols].to_dict(orient="records")
        bot5 = df.nsmallest(5, "uus_score")[cols].to_dict(orient="records")

        return {
            "total_grids": int(len(df)),
            "uus_distribution": distribution,
            "classification_distribution": class_counts,
            "indicator_statistics": indicator_stats,
            "top_5_grids": top5,
            "bottom_5_grids": bot5,
            "feature_importances": feature_importances or {},
            "explainability_note": (
                "Feature importances are global XGBoost gain-based values — "
                "not per-grid SHAP contributions."
            ),
        }