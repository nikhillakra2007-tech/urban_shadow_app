from pydantic import BaseModel, field_validator
from typing import Dict, List, Optional, Any
import math


class SimulationRequest(BaseModel):
    """Request body for the what-if simulation endpoint."""
    grid_id: str
    changes: Dict[str, float]

    @field_validator("changes")
    @classmethod
    def changes_must_be_finite(cls, v: Dict[str, float]) -> Dict[str, float]:
        for key, val in v.items():
            if math.isnan(val) or math.isinf(val):
                raise ValueError(f"Value for '{key}' must be a finite number.")
        return v


class SimulationResponse(BaseModel):
    supported: bool
    grid_id: str
    stored_uus: float
    baseline_uus: float
    simulated_uus: float
    change: float
    applied_changes: Dict[str, float]
    unsupported_changes: List[str]
    reason: Optional[str] = None
    discrepancy_note: Optional[str] = None


class AIRecommendation(BaseModel):
    priority: int
    issue: str
    recommendation: str
    affected_features: List[str]