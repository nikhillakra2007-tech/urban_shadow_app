-- The core lookup: grid_id -> all 18 metric groups + scores, one query.
SELECT
    g.grid_id, g.latitude, g.longitude,
    -- HEAT
    h.lst_mean, h.lst_summer_mean,
    -- VEGETATION
    v.ndvi_mean, v.builtup_percentage, v.landcover_class,
    -- WEATHER
    w.humidity, w.wind_speed, w.annual_rainfall, w.max_day_rainfall, w.max_monsoon_rainfall,
    -- TERRAIN
    t.elevation_mean, t.elevation_min, t.elevation_max,
    -- AIR
    a.pm25, a.pm10, a.no2, a.o3,
    -- POPULATION
    p.population, p.population_density,
    -- NIGHT
    n.nightlight_mean,
    -- WATER
    wa.water_occurrence, wa.surface_water_occurrence,
    -- ROADS
    r.road_length_km, r.major_road_length_km, r.intersection_count,
    -- TRAFFIC
    tr.traffic_signal_count,
    -- VEHICLES
    ve.parking_count, ve.fuel_station_count,
    -- WALKABILITY
    wk.footway_length_km, wk.cycleway_length_km, wk.crossing_count, wk.pedestrian_area_km2, wk.steps_count,
    -- BUILDINGS
    b.building_count, b.building_area_km2,
    -- GREEN
    gr.park_area_km2,
    -- DRAINAGE
    dr.drain_length_km,
    -- PUBLIC TRANSPORT
    pt.bus_stop_count, pt.metro_station_count, pt.transit_count,
    -- ESSENTIAL SERVICES
    es.hospital_count, es.school_count, es.pharmacy_count, es.police_count, es.public_toilet_count,
    -- COMMERCIAL
    c.commercial_area_km2, c.industrial_area_km2, c.retail_area_km2,
    -- SCORES
    s.heat_score, s.walkability_score, s.traffic_score, s.flood_score, s.air_quality_score,
    s.accessibility_score, s.transit_score, s.services_score, s.environment_score,
    s.urban_usability_score, s.usability_class
FROM urban_grid_master g
LEFT JOIN heat                h  ON h.grid_id  = g.grid_id
LEFT JOIN vegetation          v  ON v.grid_id  = g.grid_id
LEFT JOIN weather             w  ON w.grid_id  = g.grid_id
LEFT JOIN terrain             t  ON t.grid_id  = g.grid_id
LEFT JOIN air                 a  ON a.grid_id  = g.grid_id
LEFT JOIN population          p  ON p.grid_id  = g.grid_id
LEFT JOIN night               n  ON n.grid_id  = g.grid_id
LEFT JOIN water               wa ON wa.grid_id = g.grid_id
LEFT JOIN roads               r  ON r.grid_id  = g.grid_id
LEFT JOIN traffic             tr ON tr.grid_id = g.grid_id
LEFT JOIN vehicles            ve ON ve.grid_id = g.grid_id
LEFT JOIN walkability         wk ON wk.grid_id = g.grid_id
LEFT JOIN buildings           b  ON b.grid_id  = g.grid_id
LEFT JOIN green               gr ON gr.grid_id = g.grid_id
LEFT JOIN drainage            dr ON dr.grid_id = g.grid_id
LEFT JOIN public_transport    pt ON pt.grid_id = g.grid_id
LEFT JOIN essential_services  es ON es.grid_id = g.grid_id
LEFT JOIN commercial          c  ON c.grid_id  = g.grid_id
LEFT JOIN urban_scores        s  ON s.grid_id  = g.grid_id
WHERE g.grid_id = 1;   -- change grid_id as needed

-- Summary for the map layer: id + centroid + class
SELECT g.grid_id, g.latitude, g.longitude, s.urban_usability_score, s.usability_class
FROM urban_grid_master g
LEFT JOIN urban_scores s ON s.grid_id = g.grid_id
ORDER BY s.urban_usability_score DESC;