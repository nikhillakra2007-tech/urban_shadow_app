class RecommendationService:
    """
    Deterministic, rule-based recommendation engine.
    Uses actual indicator thresholds derived from the dataset.
    Does NOT call any external LLM or AI service.
    All feature names reference the 36 trained model features or dataset columns.
    """

    # ATM note: dist_atms_m IS in the model (index 8). It measures distance
    # to the nearest ATM — a SMALLER value means BETTER access.
    # ndvi_2024_mean IS in the model — proxy for green cover / vegetation.

    def __init__(self, grid_service, model_service=None):
        self.gs = grid_service
        self.ms = model_service  # optional, used for future SHAP integration

    def get_suggestions(self, grid_id: str) -> list[dict]:
        grid = self.gs.get_grid(grid_id)
        if not grid:
            return []

        suggestions = []

        # ── Air Quality ──────────────────────────────────────────────────────
        pm25 = grid.get("predicted_pm25", 0) or 0
        if pm25 > 200:
            suggestions.append({
                "priority": 1,
                "issue": "Extremely High PM2.5 Levels",
                "recommendation": (
                    "Implement localised traffic restrictions and establish green buffer zones. "
                    "Enforce industrial emission controls within 2 km."
                ),
                "affected_features": ["predicted_pm25", "ndvi_2024_mean"],
            })
        elif pm25 > 100:
            suggestions.append({
                "priority": 2,
                "issue": "Elevated PM2.5 Levels",
                "recommendation": (
                    "Increase urban tree cover (ndvi_2024_mean) to filter particulates. "
                    "Promote public transport to reduce vehicular emissions."
                ),
                "affected_features": ["predicted_pm25", "ndvi_2024_mean"],
            })

        pm10 = grid.get("predicted_pm10", 0) or 0
        if pm10 > 300:
            suggestions.append({
                "priority": 2,
                "issue": "High PM10 Levels",
                "recommendation": (
                    "Implement dust suppression measures on unpaved roads. "
                    "Regulate construction activity in the grid."
                ),
                "affected_features": ["predicted_pm10"],
            })

        # ── Healthcare ───────────────────────────────────────────────────────
        hosp_dist = grid.get("dist_hospitals_m", 0) or 0
        if hosp_dist > 5000:
            suggestions.append({
                "priority": 1,
                "issue": "Poor Healthcare Proximity",
                "recommendation": (
                    "Establish a community health center or mobile clinic within 2 km. "
                    "Priority for elderly and paediatric care."
                ),
                "affected_features": ["dist_hospitals_m"],
            })

        pharm_dist = grid.get("dist_pharmacies_m", 0) or 0
        if pharm_dist > 3000:
            suggestions.append({
                "priority": 2,
                "issue": "Limited Pharmacy Access",
                "recommendation": (
                    "Partner with Jan Aushadhi scheme to open a generic medicines outlet."
                ),
                "affected_features": ["dist_pharmacies_m"],
            })

        # ── Transport ────────────────────────────────────────────────────────
        metro_dist = grid.get("dist_metro_m", 0) or 0
        bus_dist   = grid.get("dist_bus_stops_m", 0) or 0
        if metro_dist > 3000 and bus_dist > 1500:
            suggestions.append({
                "priority": 2,
                "issue": "Poor Public Transport Connectivity",
                "recommendation": (
                    "Add feeder bus routes to the nearest metro station. "
                    "Introduce e-rickshaw last-mile connectivity."
                ),
                "affected_features": ["dist_metro_m", "dist_bus_stops_m", "dist_public_transport_stops_m"],
            })

        # ── ATM / Banking ────────────────────────────────────────────────────
        # dist_atms_m IS a trained model feature — lower is better
        atm_dist = grid.get("dist_atms_m", 0) or 0
        if atm_dist > 2000:
            suggestions.append({
                "priority": 3,
                "issue": "Low ATM / Financial Services Access",
                "recommendation": (
                    "Install IPPB or SBI ATM kiosks at nearby post offices or panchayat bhawans. "
                    "Enable banking correspondent (BC) agents at kirana stores."
                ),
                "affected_features": ["dist_atms_m", "dist_banks_m"],
            })

        # ── Green Cover ──────────────────────────────────────────────────────
        # ndvi_2024_mean is a model feature; higher is better (more vegetation)
        ndvi = grid.get("ndvi_2024_mean", 0.3) or 0.3
        if ndvi < 0.1:
            suggestions.append({
                "priority": 3,
                "issue": "Very Low Vegetation / Green Cover",
                "recommendation": (
                    "Plant native species along road medians and in vacant plots. "
                    "Note: adding trees improves ndvi_2024_mean over time; "
                    "use the simulator with ndvi_2024_mean to model the effect."
                ),
                "affected_features": ["ndvi_2024_mean"],
            })

        # ── Water Infrastructure ─────────────────────────────────────────────
        water_occ = grid.get("water_occurrence_mean", 50) or 50
        if water_occ < 10:
            suggestions.append({
                "priority": 3,
                "issue": "Low Surface Water Availability",
                "recommendation": (
                    "Invest in rainwater harvesting structures and rejuvenate local water bodies. "
                    "water_occurrence_mean captures seasonal surface water presence in this grid."
                ),
                "affected_features": ["water_occurrence_mean"],
            })

        # ── Sanitation ───────────────────────────────────────────────────────
        toilet_dist = grid.get("dist_toilets_m", 0) or 0
        if toilet_dist > 2000:
            suggestions.append({
                "priority": 3,
                "issue": "Insufficient Public Sanitation",
                "recommendation": (
                    "Deploy pre-fabricated toilet units under Swachh Bharat Mission. "
                    "Target high-footfall areas first."
                ),
                "affected_features": ["dist_toilets_m"],
            })

        # ── Schools ──────────────────────────────────────────────────────────
        school_dist = grid.get("dist_schools_m", 0) or 0
        if school_dist > 3000:
            suggestions.append({
                "priority": 2,
                "issue": "Poor School Proximity",
                "recommendation": (
                    "Establish a government primary school or satellite learning centre. "
                    "Provide subsidised transport to the nearest school."
                ),
                "affected_features": ["dist_schools_m"],
            })

        # Sort by priority
        suggestions.sort(key=lambda x: x["priority"])
        return suggestions