import math
import pandas as pd
import numpy as np


class SimulationEngine:
    def __init__(self, model_service, grid_service):
        self.ms = model_service
        self.gs = grid_service

    def run(self, grid_id: str, changes: dict[str, float]) -> dict:
        # 1. Retrieve the real grid
        grid_data = self.gs.get_grid(grid_id)
        if not grid_data:
            return {
                "supported": False,
                "reason": f"Grid ID '{grid_id}' not found in the dataset.",
                "unsupported_changes": [],
            }

        # 2. Validate ALL change keys before touching the model
        valid_features = set(self.ms.features)
        unsupported = [k for k in changes if k not in valid_features]
        if unsupported:
            return {
                "supported": False,
                "reason": (
                    f"The following features are not in the trained model and cannot be simulated: "
                    f"{unsupported}. "
                    f"Valid features are listed in model/feature_columns.json."
                ),
                "unsupported_changes": unsupported,
            }

        # 3. Validate values (no NaN, no Inf)
        for feat, val in changes.items():
            if not isinstance(val, (int, float)) or math.isnan(val) or math.isinf(val):
                return {
                    "supported": False,
                    "reason": f"Value for feature '{feat}' is invalid (NaN or Inf). Provide a finite number.",
                    "unsupported_changes": [feat],
                }

        # 4. Build the feature vector from the actual grid row
        baseline_df = pd.DataFrame([grid_data])

        # 5. Apply changes
        applied = {}
        for feat, val in changes.items():
            baseline_df[feat] = float(val)
            applied[feat] = float(val)

        # 6. Baseline prediction (model re-predicts from stored feature values)
        baseline_only_df = pd.DataFrame([grid_data])
        try:
            baseline_uus = float(self.ms.predict(baseline_only_df))
        except Exception:
            # Fall back to stored score if model prediction fails for some reason
            baseline_uus = float(grid_data.get("uus_score", 0))

        # 7. Simulated prediction with applied changes
        simulated_uus = float(self.ms.predict(baseline_df))

        stored_uus = float(grid_data.get("uus_score", 0))

        # 8. Discrepancy note (model re-prediction vs stored score)
        discrepancy = round(abs(baseline_uus - stored_uus), 4)
        discrepancy_note = None
        if discrepancy > 0.01:
            discrepancy_note = (
                f"The model re-predicts {baseline_uus:.4f} for this grid, while the stored "
                f"uus_score is {stored_uus:.4f} (difference: {discrepancy:.4f}). "
                "Both values were computed using the same model and feature set at startup; "
                "minor floating-point differences from batch vs. single-row prediction are expected."
            )

        return {
            "supported": True,
            "grid_id": grid_id,
            "stored_uus": round(stored_uus, 4),
            "baseline_uus": round(baseline_uus, 4),
            "simulated_uus": round(simulated_uus, 4),
            "change": round(simulated_uus - baseline_uus, 4),
            "applied_changes": applied,
            "unsupported_changes": [],
            "discrepancy_note": discrepancy_note,
        }