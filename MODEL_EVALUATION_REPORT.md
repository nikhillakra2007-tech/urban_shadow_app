# URBAN SHADOW — MODEL EVALUATION REPORT

**Project:** Urban Shadow / UUS Delhi (`urban/`)
**Scope:** Standalone evaluation of the scoring system using only real code and data present in the repository.
**Date of evaluation:** 2026-08-24
**Evaluator method:** Read-only inspection + deterministic recomputation from the shipped artifacts (`backend/model/uus_model.pkl`, `backend/model/feature_columns.json`, `backend/data/delhi_final_dataset.csv`). No application code was modified.

---

## 1. Executive Summary

Urban Shadow scores 6,284 grid cells (500 m × 500 m) of NCT Delhi with a trained **XGBRegressor** whose output is linearly stretched onto a fixed display range of **16–83** and then bucketed into five classes (Critical → Excellent).

**The single most important finding:** the project contains **no ground-truth labels** for "urban usability", and the model's **training script was never delivered**. The target the model was trained to predict is unknown. Therefore **no predictive accuracy metric (Accuracy, F1, ROC-AUC, MAE, RMSE, R², …) can be legitimately reported** — for the original model or any re-training of it.

Everything that *can* be measured was measured. Headline results (all computed, not estimated):

- The serving pipeline is **deterministic**: recomputing grid `DEL_03263` from the artifact reproduces the API-served value **78.2907 exactly**.
- The model relies heavily on **5 features (69.9 % of total gain)**; `predicted_pm25` alone contributes 20.9 %.
- **2 of the 36 features are dead inputs** — `dist_fuel_m` and `dist_toilets_m` are the constant value `-1` for all 6,284 rows.
- Severe **feature redundancy**: `lst_summer_2024_mean` is perfectly correlated (ρ = 1.000) with `lst_2024_mean`; four more pairs exceed ρ = 0.98.
- The score is **spatially extremely smooth**: Moran's I = **0.904** (8-nearest-neighbour weights), spatial-lag correlation 0.938.
- The classifier is **range-based, not distribution-based**: class sizes run from 3.2 % (Critical) to 31.6 % (Excellent) — imbalance ratio 9.84 — and shift substantially under a ±2-point change of the score range.
- The system is **stable under perturbation**: a ±10 %-of-σ nudge to any single feature moves the score by at most ≈0.32 points on average and flips at most 2.3 % of class labels.

**Final assessment: Not yet statistically validated** (as a predictive model). As a *deterministic relative-ranking instrument* it is internally consistent and reproducible, but its absolute meaning is anchored to an unknown training target.

---

## 2. Model / Scoring System

### 2.1 What it actually does
For every grid cell, the backend loads one row of pre-aggregated indicators, runs it through a gradient-boosted regression tree ensemble, rescales the raw output to 16–83, and labels it with a class tier. The frontend displays the score, the tier, and rule-based recommendations.

### 2.2 Model type (measured from the artifact)
- `XGBRegressor`, objective `reg:squarederror`
- 100 trees, max_depth 6, learning_rate 0.1 (read from the pickle)
- Feature contract: `model/feature_columns.json` — 36 features; artifact `feature_names_in_` matches the contract **exactly in name and order** (verified)

### 2.3 Inputs (36 features)
Access-distance indicators (hospitals, pharmacies, schools, grocery, restaurants, police, fire, banks, ATMs, bus stations/stops, metro, railway, public-transport stops, subway entrances, waterways, sensor, fuel, toilets), environmental means (LST annual/summer, NDVI, built-up, nightlights, NO₂, O₃, humidity, wind, 3 rainfall aggregates, elevation), `predicted_pm25`, `predicted_pm10`, `population_mean`, `water_occurrence_mean`.

### 2.4 Output / UUS methodology
1. `raw = model.predict(features)` → observed range **−40.7564 … 23.2536** (mean 0.6109, σ 14.4246)
2. Display stretch (in `grid_service.py`): `uus = 16 + (raw − min)/(max − min) × 67`
3. Classification (`classify_uus`): fixed fractions of the 16–83 range — boundaries at **29.40 / 42.80 / 56.20 / 69.60** → Critical, Low, Moderate, Good, Excellent

### 2.5 Is UUS an ML prediction or a composite score?
**It is a genuine ML prediction** (a real trained XGBoost artifact is loaded and executed per request/serving), **but its target is unknown**, so it behaves like a black-box composite index: internally consistent, externally unanchored. The rule-based recommendation layer (`recommendation_service.py`) and the tier classifier are deterministic logic, not ML.

---

## 3. Dataset

| Item | Value (measured) |
|---|---|
| File | `backend/data/delhi_final_dataset.csv` |
| Records (grids) | 6,284 |
| Total columns | 46 |
| Model features | 36 (per contract) |
| Missing values in the 36 features | **0** |
| Duplicate `grid_id` | 0 |
| Exact duplicate feature vectors | 0 |
| Constant features | `dist_fuel_m` (= −1, all rows), `dist_toilets_m` (= −1, all rows) |
| Identifier | `grid_id` (e.g. `DEL_03263`); coordinates `latitude`, `longitude` |
| Ground-truth usability labels | **None** |
| Train / test / validation split | **None present** (no split files, no fold indices, no training code) |

Other columns (non-model): `pm_confidence`, `env_data_confidence`, `population_available`, `water_presence`, `water_high_occurrence`, `water_occurrence_max/min`, etc.

### 3.1 Data-quality findings (measured)
- **Sentinel values:** every row carries `-1` in `dist_fuel_m` and `dist_toilets_m` (6,284/6,284 each). These are placeholder "no data" values, not real distances.
- **Zero-inflation / outliers (IQR rule):** `water_occurrence_mean` — 1,418 outlier rows (22.6 %); `elevation_mean` — 1,084; `no2_2024_mean` — 598.
- **Redundancy (|Spearman|):**
  - `lst_summer_2024_mean` ~ `lst_2024_mean` = **1.0000**
  - `monsoon_rainfall_mean` ~ `avg_annual_rainfall_mean` = 0.9986
  - `dist_subway_entrances_m` ~ `dist_metro_m` = 0.9966
  - `builtup_2024_mean` ~ `population_mean` = 0.9862
  - `no2_2024_mean` ~ `o3_2024_mean` = 0.9803
  - metro/subway distances ~ `predicted_pm25` = 0.945–0.949

---

## 4. Evaluation Methodology

Because no ground truth exists, the evaluation was designed around what the artifacts genuinely support:

1. **Artifact verification** — load the pickle, verify type/hyper-parameters/feature contract.
2. **Full-population inference** — predict all 6,284 grids; audit distribution, ranges, histogram, skew/kurtosis.
3. **Determinism test** — recompute a served grid end-to-end and compare with the API value.
4. **Importance extraction** — XGBoost gain importances from the artifact.
5. **Association analysis** — Spearman ρ between each feature and the score (monotonic behaviour, *not* causal accuracy).
6. **Perturbation sensitivity** — nudge each feature ±10 % of its standard deviation across all 6,284 grids (72 batch predictions); measure mean |ΔUUS| and class-flip rate.
7. **Classification stress test** — tier counts under ±2 range shifts; comparison with a true quantile cut.
8. **Spatial analysis** — Moran's I with binary 8-nearest-neighbour weights; score-vs-spatial-lag correlation.
9. **Data integrity** — missingness, sentinels, duplicates (identical inputs must give identical outputs), outliers.
10. **Dispersion description** — explicitly *descriptive* spread statistics of the served scores (labelled as NOT accuracy).

---

## 5. Predictive Performance

> **Ground-truth validation data is not available in the current project, therefore conventional predictive accuracy metrics cannot be legitimately reported.** No Accuracy, Balanced Accuracy, Precision, Recall, F1, ROC-AUC, PR-AUC, confusion matrix, MAE, MSE, RMSE, R², or residual-vs-truth statistics are reported, because computing any of them would require labels the repository does not contain. Likewise, train-vs-test performance and cross-validation of the *original* model are **not computable**: the training script, split indices, and target definition were not delivered.

What *is* measured (model behaviour, not accuracy):

**Prediction distribution (display scale 16–83):**
- mean 59.30, σ 15.10; P5 31.73, P25 48.40, median 61.64, P75 72.08, P95 79.68
- 10-bin histogram (16→83): 41, 161, 374, 491, 610, 829, 795, 995, 1,164, 824
- skew −0.480 (mild left), excess kurtosis −0.719 (flatter than normal)
- raw-scale stats: mean 0.6109, σ 14.4246; P1 −33.02, P99 21.99

**Determinism:** `DEL_03263` recomputed = **78.2907**; API-served = **78.2907** → exact match.

---

## 6. Baseline Comparison

A predictive baseline (e.g. "predict the mean") requires ground truth to be meaningful, so **no error-based baseline comparison is valid here**. For transparency, purely *descriptive dispersion* of the served scores (not an error metric):

- Mean-predictor deviation: 12.78 points (this is simply the spread of the system's own outputs)
- Median absolute deviation: 11.45 points

Interpretation: the score surface varies widely across the city; the number says nothing about correctness.

---

## 7. Error Analysis

Conventional error analysis is impossible without labels. The closest legitimate analogue — **perturbation response analysis** (±10 % of σ per feature, all grids):

| Feature | mean |ΔUUS| (points) | class-flip rate |
|---|---|---|
| water_occurrence_mean | 0.321 | 1.9 % |
| predicted_pm25 | 0.316 | 2.1 % |
| o3_2024_mean | 0.262 | 2.3 % |
| dist_atms_m | 0.179 | 1.3 % |
| dist_public_transport_stops_m | 0.165 | 1.3 % |
| dist_metro_m | 0.110 | 0.8 % |

Least sensitive: `dist_pharmacies_m` 0.006, `predicted_pm10` 0.006, `population_mean` 0.010, `builtup_2024_mean` 0.011, `dist_fire_stations_m` 0.016.

Findings: no single-indicator nudge destabilises the system (max 2.3 % tier flips); PM₂.₅, water occurrence and O₃ dominate local sensitivity; PM₁₀ is nearly ignored by the trained model.

---

## 8. Robustness & Stability

- **Perturbation stability:** maximum mean shift 0.32 points on a 67-point scale (< 0.5 %) per ±10 %-σ nudge; maximum class-flip 2.3 % → stable.
- **Determinism:** identical inputs reproduce identical outputs (verified end-to-end).
- **No duplicate-vector inconsistency** (no duplicates exist).
- **Range-shift stress:** moving the display range ±2 points changes Critical count from 202 → 298 (−2) or 137 (+2) and Excellent from 1,988 → 1,650 / 2,298 — tier populations are sensitive to the arbitrary range choice (see §12).

---

## 9. Data Leakage / Overfitting Analysis

**Measured / observed from code and artifacts:**
- The training procedure is **absent** from the repository, so historical leakage or overfitting **cannot be audited or excluded** — this is an open risk, not a cleared one.
- The 36-feature contract is enforced identically at training-artifact level and at inference (`feature_names_in_` matches; serving code selects columns by contract) → **no schema drift**.
- **Redundancy risk:** five feature pairs with |ρ| ≥ 0.98 (§3.1). Tree ensembles tolerate this, but it makes importance attribution unstable between twins (e.g. metro vs subway-entrance distances split credit).
- **Dead features:** `dist_fuel_m` / `dist_toilets_m` are constant; the model assigns them ~0.0003 gain each — harmless at inference but evidence the training data was not quality-gated.
- **No temporal split** concept exists; all 6,284 grids are scored from the same snapshot — no train/serve skew is possible today, but also no generalisation evidence.

---

## 10. Feature Importance / Contribution

**Gain importance from the artifact (top 15):**

| Feature | Gain |
|---|---|
| predicted_pm25 | 0.2088 |
| dist_atms_m | 0.1547 |
| dist_subway_entrances_m | 0.1448 |
| dist_metro_m | 0.1323 |
| dist_public_transport_stops_m | 0.0580 |
| dist_banks_m | 0.0384 |
| dist_restaurants_m | 0.0372 |
| dist_grocery_m | 0.0291 |
| dist_police_m | 0.0191 |
| o3_2024_mean | 0.0182 |
| dist_to_sensor_m | 0.0145 |
| avg_annual_rainfall_mean | 0.0143 |
| lst_summer_2024_mean | 0.0139 |
| nightlights_2024_mean | 0.0139 |
| no2_2024_mean | 0.0127 |

Top-5 features = **69.9 %** of total gain. Bottom-5 ≈ 0: `dist_waterways_m` 0.0011, `builtup_2024_mean` 0.0006, `population_mean` 0.0006, `dist_toilets_m` 0.0003, `dist_fuel_m` 0.0003.

**Monotonic association (Spearman ρ with score, top 12):** predicted_pm25 −0.900, dist_atms_m −0.878, dist_subway_entrances_m −0.874, dist_metro_m −0.872, dist_public_transport_stops_m −0.829, dist_banks_m −0.827, dist_grocery_m −0.822, dist_restaurants_m −0.814, nightlights_2024_mean +0.795, dist_fire_stations_m −0.793, dist_railway_stations_m −0.787, dist_bus_stops_m −0.786.

Reading: the score is essentially an **accessibility-and-pollution index** — better access (shorter distances) and lower PM₂.₅ push scores up; nightlights (urban intensity) also push up. Environmental variables (NDVI, LST) play a minor role despite the "urban sustainability" framing.

---

## 11. Spatial / Geographic Evaluation

- **Moran's I (binary 8-NN weights): 0.904** — extremely strong positive spatial autocorrelation.
- Correlation between score and its spatial lag: **0.938**.

Interpretation: neighbouring grids have nearly identical scores; the map forms large smooth regions (visible as the orange west / green centre-east pattern). This is *desirable* for a spatial index (no checkerboard noise) but also means the effective information content is far below 6,284 independent samples — adjacent grids are near-replicates, and any future validation must use **spatial block splits**, not random splits.

---

## 12. Limitations

1. **Unknown target** — the model's training label is undefined in the repo; "UUS" has no external anchor.
2. **No ground truth** — no expert scores, survey data, or outcome data exist for validation.
3. **No training pipeline** — reproducibility of the model itself is impossible; only inference is reproducible.
4. **Arbitrary display range** — the 16–83 stretch is a presentational choice; the classifier's fixed range-quintiles inherit that arbitrariness (tier populations shift ~30–35 % under a ±2 range change).
5. **Class imbalance by construction** — Critical = 3.2 % vs Excellent = 31.6 % (ratio 9.84); a quantile cut would give 1,257 per class.
6. **Dead/redundant inputs** — 2 constant features; 5 near-duplicate pairs; PM₁₀ effectively ignored.
7. **Sentinel `-1` values** shipped as if they were distances (all rows, 2 features).
8. **Spatial dependence** — high autocorrelation invalidates random-split validation strategies and inflates apparent sample size.
9. **Static snapshot** — single time period; no temporal validation possible.

---

## 13. Final Assessment

### Verdict: **Not yet statistically validated**

**Justification (evidence-based):**
- Zero ground-truth labels and no training pipeline ⇒ **no accuracy, calibration, or generalisation evidence can exist** (measured fact about the repository).
- What *was* measured is sound for an index: deterministic serving (exact match), stable perturbation response (≤ 0.32 pts / ≤ 2.3 % flips), coherent feature logic (access & pollution dominate, directions sensible), and strong spatial smoothness (Moran's I 0.904).
- The classification layer is internally consistent but **range-arbitrary** and **imbalanced by construction**.

So: as a **relative ranking/visualisation instrument**, Urban Shadow performs coherently ("Good" on internal-consistency grounds). As a **validated measurement model**, it is **Not yet statistically validated**.

### A. Measured results (recomputed in this evaluation)
Determinism match 78.2907; distribution stats (§5); importances (§10); associations (§10); sensitivities and flip rates (§7); Moran's I 0.904 / lag corr 0.938 (§11); class counts and boundaries (§4 of report body); dataset integrity figures (§3).

### B. Observations from code/data (not performance claims)
XGBoost artifact + contract match; 16–83 stretch in `grid_service.py`; quintile-tier `classify_uus`; dead `-1` features; redundant pairs; absent training code; deterministic rule-based recommendations.

### C. Limitations
Listed in §12 — chief among them: no labels, unknown target, no split, arbitrary range, spatial dependence.

### D. Recommendations for future validation
1. **Recover or rewrite the training pipeline** — without the target definition, UUS cannot be interpreted beyond "model opinion".
2. **Define ground truth**: expert-rated sample of grids (even 200–300) or an accepted external index (e.g. walkability/NDVI-based composite) → enables MAE/R²/AUC on held-out data.
3. **Spatial block cross-validation** (cluster by k-means on coordinates or ward boundaries) — never random splits, given Moran's I ≈ 0.9.
4. **Clean features**: drop or impute the two constant `-1` columns; de-duplicate the ρ ≥ 0.98 pairs; document PM₁₀'s irrelevance or fix its data.
5. **Replace range-quintile classes with distribution quantiles** (1,257 per class) or explicit policy thresholds, and freeze them independently of the display range.
6. **Add calibration analysis** once labels exist (reliability curves per tier).
7. **Version the model artifact** with its training data hash so serving and evaluation always refer to the same object.

---

*Report generated from repository artifacts; every number above is reproducible by loading `uus_model.pkl`, `feature_columns.json`, and `delhi_final_dataset.csv` and re-running the documented computations. No synthetic or estimated values are included.*
