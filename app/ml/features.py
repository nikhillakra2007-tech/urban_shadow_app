"""Feature engineering - build the training frame by joining all group tables.

One row per grid cell. The feature vector is built in GROUP_FEATURES order
(same order used at inference time), targets are the urban_scores columns.
"""

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    FEATURE_COLUMNS,
    GROUP_FEATURES,
    SCORE_COLUMNS,
    UrbanGridMaster,
)

GROUP_ATTRS = [
    "heat", "vegetation", "weather", "terrain", "air", "population", "night",
    "water", "roads", "traffic", "vehicles", "walkability", "buildings", "green",
    "drainage", "public_transport", "essential_services", "commercial", "scores",
]


def build_training_frame(db: Session) -> pd.DataFrame:
    loaders = [selectinload(getattr(UrbanGridMaster, a)) for a in GROUP_ATTRS]
    grids = (
        db.execute(select(UrbanGridMaster).options(*loaders))
        .scalars()
        .all()
    )

    rows = []
    for g in grids:
        row: dict = {}
        for attr, cols in GROUP_FEATURES.items():
            obj = getattr(g, attr)
            for col in cols:
                row[col] = getattr(obj, col, None) if obj else None
        scores = g.scores
        for col in SCORE_COLUMNS:
            row[col] = getattr(scores, col, None) if scores else None
        rows.append(row)

    frame = pd.DataFrame(rows, columns=FEATURE_COLUMNS + SCORE_COLUMNS)
    return frame.fillna(0.0)