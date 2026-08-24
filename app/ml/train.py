"""Train the urban scoring model(s) from joined group tables.

- RandomForestRegressor  -> predicts urban_usability_score
- RandomForestClassifier -> predicts usability_class (High/Moderate/Low/Very Low)

Usage:
    python -m app.ml.train

If the DB has no rows, a synthetic dataset is generated so training works
end-to-end for the demo.
"""

import logging
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

from app.config import settings
from app.database import SessionLocal, init_db
from app.ml.features import FEATURE_COLUMNS, build_training_frame
from app.services.score_calculator import classify

logger = logging.getLogger(__name__)

REGRESS_TARGET = "urban_usability_score"
CLASS_TARGET = "usability_class"


def _regressor_path() -> str:
    return os.path.join(settings.model_dir, "urban_score_regressor.joblib")


def _classifier_path() -> str:
    return os.path.join(settings.model_dir, "urban_class_classifier.joblib")


def train(db=None, force_synthetic: bool = False) -> dict:
    frame = None
    own_session = db is None
    try:
        init_db()
        db = db or SessionLocal()
        frame = build_training_frame(db)
    except Exception as exc:  # DB unreachable / not configured -> synthetic
        logger.warning("Could not load real data (%s) - using synthetic fallback", exc)
        force_synthetic = True
    finally:
        if own_session and db is not None:
            db.close()

    if frame is None or frame.empty or force_synthetic:
        frame = _synthetic_frame()
        logger.info("No real data - training on %d synthetic samples", len(frame))

    X = frame[FEATURE_COLUMNS]
    y_reg = frame[REGRESS_TARGET]
    y_cls = frame[CLASS_TARGET]

    X_train, X_test, y_train, y_test = train_test_split(X, y_reg, test_size=0.2, random_state=42)
    _, _, cls_train, cls_test = train_test_split(X, y_cls, test_size=0.2, random_state=42)

    reg = RandomForestRegressor(n_estimators=200, max_depth=12, random_state=42)
    reg.fit(X_train, y_train)
    pred_reg = reg.predict(X_test)
    reg_metrics = {
        "mae": float(mean_absolute_error(y_test, pred_reg)),
        "r2": float(r2_score(y_test, pred_reg)),
    }

    clf = RandomForestClassifier(n_estimators=200, max_depth=10, random_state=42)
    clf.fit(X_train, cls_train)
    pred_cls = clf.predict(X_test)
    clf_metrics = {
        "accuracy": float(accuracy_score(cls_test, pred_cls)),
        "classes": sorted(clf.classes_.tolist()),
    }

    os.makedirs(settings.model_dir, exist_ok=True)
    joblib.dump({"model": reg, "columns": FEATURE_COLUMNS}, _regressor_path())
    joblib.dump({"model": clf, "columns": FEATURE_COLUMNS}, _classifier_path())

    metrics = {
        "samples": int(len(frame)),
        "regressor": reg_metrics,
        "classifier": clf_metrics,
    }
    logger.info("Models saved | %s", metrics)
    return metrics


def _synthetic_frame(n: int = 3000, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    data = {}
    # heat
    data["lst_mean"] = rng.uniform(28, 55, n)
    data["lst_summer_mean"] = data["lst_mean"] + rng.uniform(2, 8, n)
    # vegetation
    data["ndvi_mean"] = rng.uniform(-0.1, 0.8, n)
    data["builtup_percentage"] = rng.uniform(0, 100, n)
    # weather
    data["humidity"] = rng.uniform(20, 95, n)
    data["wind_speed"] = rng.uniform(0, 35, n)
    data["annual_rainfall"] = rng.uniform(300, 1800, n)
    data["max_day_rainfall"] = rng.uniform(20, 200, n)
    data["max_monsoon_rainfall"] = rng.uniform(100, 600, n)
    # terrain
    data["elevation_mean"] = rng.uniform(100, 350, n)
    data["elevation_min"] = data["elevation_mean"] - rng.uniform(5, 30, n)
    data["elevation_max"] = data["elevation_mean"] + rng.uniform(5, 30, n)
    # air
    data["pm25"] = rng.uniform(20, 300, n)
    data["pm10"] = rng.uniform(40, 500, n)
    data["no2"] = rng.uniform(5, 80, n)
    data["o3"] = rng.uniform(10, 120, n)
    # population
    data["population"] = rng.uniform(0, 30000, n)
    data["population_density"] = data["population"] / 0.25
    # night
    data["nightlight_mean"] = rng.uniform(0, 65, n)
    # water
    data["water_occurrence"] = rng.uniform(0, 100, n)
    data["surface_water_occurrence"] = rng.uniform(0, 100, n)
    # roads
    data["road_length_km"] = rng.uniform(0, 30, n)
    data["major_road_length_km"] = rng.uniform(0, 8, n)
    data["intersection_count"] = rng.integers(0, 200, n)
    # traffic
    data["traffic_signal_count"] = rng.integers(0, 80, n)
    # vehicles
    data["parking_count"] = rng.integers(0, 60, n)
    data["fuel_station_count"] = rng.integers(0, 15, n)
    # walkability
    data["footway_length_km"] = rng.uniform(0, 12, n)
    data["cycleway_length_km"] = rng.uniform(0, 6, n)
    data["crossing_count"] = rng.integers(0, 150, n)
    data["pedestrian_area_km2"] = rng.uniform(0, 0.5, n)
    data["steps_count"] = rng.integers(0, 300, n)
    # buildings
    data["building_count"] = rng.integers(0, 2000, n)
    data["building_area_km2"] = rng.uniform(0, 1.2, n)
    # green
    data["park_area_km2"] = rng.uniform(0, 0.8, n)
    # drainage
    data["drain_length_km"] = rng.uniform(0, 25, n)
    # public transport
    data["bus_stop_count"] = rng.integers(0, 60, n)
    data["metro_station_count"] = rng.integers(0, 6, n)
    data["transit_count"] = data["bus_stop_count"] + data["metro_station_count"]
    # essential services
    data["hospital_count"] = rng.integers(0, 10, n)
    data["school_count"] = rng.integers(0, 20, n)
    data["pharmacy_count"] = rng.integers(0, 25, n)
    data["police_count"] = rng.integers(0, 8, n)
    data["public_toilet_count"] = rng.integers(0, 15, n)
    # commercial
    data["commercial_area_km2"] = rng.uniform(0, 0.9, n)
    data["industrial_area_km2"] = rng.uniform(0, 0.6, n)
    data["retail_area_km2"] = rng.uniform(0, 0.5, n)

    frame = pd.DataFrame(data)

    heat = 100 * (1 - np.clip((frame["lst_mean"] - 30) / 30, 0, 1))
    walk = 100 * np.clip((frame["footway_length_km"] + frame["cycleway_length_km"]
                          + 0.05 * frame["crossing_count"] + 100 * frame["pedestrian_area_km2"]
                          + 0.01 * frame["steps_count"]) / 15, 0, 1)
    traffic = 100 * (1 - np.clip((frame["traffic_signal_count"] * 2 + frame["intersection_count"] * 0.5
                                  + frame["major_road_length_km"] * 10) / 60, 0, 1))
    flood = 100 * (1 - np.clip((frame["annual_rainfall"] / 2500 + frame["max_monsoon_rainfall"] / 300
                                + frame["water_occurrence"] / 100 + frame["surface_water_occurrence"] / 100
                                - frame["drain_length_km"] / 20), 0, 1))
    air = 100 * (1 - np.clip((frame["pm25"] / 250 + frame["pm10"] / 400
                              + frame["no2"] / 80 + frame["o3"] / 120) / 4, 0, 1))
    access = 100 * np.clip((frame["road_length_km"] * 3 + frame["intersection_count"] * 0.3
                            + frame["parking_count"] * 0.5 + frame["fuel_station_count"] * 2) / 40, 0, 1)
    transit = 100 * np.clip((frame["bus_stop_count"] + frame["metro_station_count"] * 5
                             + frame["transit_count"]) / 30, 0, 1)
    services = 100 * np.clip((frame["hospital_count"] * 5 + frame["school_count"] * 3
                              + frame["pharmacy_count"] * 2 + frame["police_count"] * 2
                              + frame["public_toilet_count"]) / 30, 0, 1)
    env = 100 * np.clip((frame["ndvi_mean"] + frame["park_area_km2"] * 10) / 1.2, 0, 1)

    frame["urban_usability_score"] = (
        0.15 * heat + 0.10 * walk + 0.10 * traffic + 0.10 * flood + 0.10 * air
        + 0.10 * access + 0.10 * transit + 0.10 * services + 0.15 * env
    )
    frame["usability_class"] = frame["urban_usability_score"].apply(classify)
    # keep sub-scores so the frame matches DB schema
    frame["heat_score"] = heat
    frame["walkability_score"] = walk
    frame["traffic_score"] = traffic
    frame["flood_score"] = flood
    frame["air_quality_score"] = air
    frame["accessibility_score"] = access
    frame["transit_score"] = transit
    frame["services_score"] = services
    frame["environment_score"] = env

    return frame


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(train())