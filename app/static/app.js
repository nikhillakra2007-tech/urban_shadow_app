/* Urban Shadow — frontend app */
(() => {
  const API = "/api/v1";

  const CLASS_COLORS = {
    "High Usability": "#1a9850",
    "Moderate Usability": "#91cf60",
    "Low Usability": "#fc8d59",
    "Very Low Usability": "#d73027",
  };
  const CLASS_ORDER = ["Very Low Usability", "Low Usability", "Moderate Usability", "High Usability"];

  const $ = (sel) => document.querySelector(sel);
  const fmt = (v, d = 1) => (v === null || v === undefined || isNaN(v) ? "—" : Number(v).toFixed(d));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function api(path, opts = {}) {
    const r = await fetch(API + path, opts);
    if (!r.ok) {
      let msg = `HTTP ${r.status}`;
      try { const j = await r.json(); msg = j.detail || msg; } catch (_) {}
      throw new Error(msg);
    }
    return r.json();
  }

  /* ============ Navigation ============ */
  const views = ["map", "explore", "compare", "ml", "about"];
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      views.forEach((v) => $("#view-" + v).classList.remove("active"));
      $("#view-" + btn.dataset.view).classList.add("active");
      if (btn.dataset.view === "map" && map) setTimeout(() => map.invalidateSize(), 60);
    });
  });

  /* ============ Global stats ============ */
  let classPie = null;
  async function loadStats() {
    try {
      const s = await api("/stats");
      $("#st-total").textContent = s.total_cells;
      $("#st-scored").textContent = s.scored_cells + " (" + s.coverage_pct + "%)";
      $("#st-avg").textContent = fmt(s.avg_usability_score);
      const d = s.class_distribution || {};
      $("#st-high").textContent = d["High Usability"] || 0;
      $("#st-moderate").textContent = d["Moderate Usability"] || 0;
      $("#st-low").textContent = (d["Low Usability"] || 0) + (d["Very Low Usability"] || 0);

      const labels = CLASS_ORDER.filter((c) => (d[c] || 0) > 0);
      const ctx = document.getElementById("class-pie");
      if (classPie) classPie.destroy();
      classPie = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [{
            data: labels.map((c) => d[c]),
            backgroundColor: labels.map((c) => CLASS_COLORS[c] || "#8ea0bf"),
            borderColor: "#0b1220", borderWidth: 3,
          }],
        },
        options: {
          plugins: {
            legend: { position: "bottom", labels: { color: "#8ea0bf", font: { size: 10 }, boxWidth: 10 } },
            tooltip: { callbacks: { label: (i) => ` ${i.label}: ${i.raw} cells (${(100 * i.raw / s.total_cells).toFixed(1)}%)` } },
          },
        },
      });
    } catch (e) { console.error("stats:", e); }
  }

  /* ============ Map ============ */
  let map, scoreLayer;

  function scoreColor(score) {
    if (score === null || score === undefined) return "#2a3654";
    const stops = [
      [20, [215, 48, 39]],
      [35, [252, 141, 89]],
      [50, [254, 224, 139]],
      [65, [217, 239, 139]],
      [80, [145, 207, 96]],
      [100, [26, 150, 65]],
    ];
    const s = Math.max(20, Math.min(100, score));
    for (let i = 1; i < stops.length; i++) {
      const [v0, c0] = stops[i - 1], [v1, c1] = stops[i];
      if (s <= v1) {
        const t = (s - v0) / (v1 - v0);
        return `rgb(${Math.round(c0[0] + (c1[0] - c0[0]) * t)},${Math.round(c0[1] + (c1[1] - c0[1]) * t)},${Math.round(c0[2] + (c1[2] - c0[2]) * t)})`;
      }
    }
    return "rgb(26,150,65)";
  }

  function initMap() {
    map = L.map("map", { zoomControl: true, attributionControl: true }).setView([28.63, 77.21], 10);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd", maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);

    api("/map").then((fc) => {
      scoreLayer = L.geoJSON(fc, {
        style: (f) => ({ color: scoreColor(f.properties.urban_usability_score), weight: 0.5, fillOpacity: 0.75 }),
        onEachFeature: (f, layer) => {
          const p = f.properties;
          layer.on("click", () => openCellDetail(p.grid_id));
          layer.bindTooltip(
            `<b>Grid ${p.grid_id}</b><br/>Score: <b>${fmt(p.urban_usability_score)}</b><br/>${esc(p.usability_class)}`,
            { sticky: true }
          );
        },
      }).addTo(map);
      map.fitBounds(scoreLayer.getBounds(), { padding: [20, 20] });
    }).catch((e) => console.error("map:", e));
  }

  /* ============ Cell detail (map popup) ============ */
  let radarChart = null;

  async function openCellDetail(gridId) {
    try {
      const b = await api(`/grids/${gridId}/bundle`);
      const s = b.scores || {};
      const cls = s.usability_class || "No score";
      const color = CLASS_COLORS[cls] || "#8ea0bf";
      const radarData = [
        ["Heat", s.heat_score], ["Walk", s.walkability_score], ["Traffic", s.traffic_score],
        ["Flood", s.flood_score], ["Air", s.air_quality_score], ["Access", s.accessibility_score],
        ["Transit", s.transit_score], ["Services", s.services_score], ["Env", s.environment_score],
      ];

      const metrics = [
        ["LST mean", b.heat?.lst_mean, "°C"], ["NDVI", b.vegetation?.ndvi_mean, ""],
        ["Buildings", b.buildings?.building_count, ""], ["Roads", b.roads?.road_length_km, "km"],
        ["Hospitals", b.essential_services?.hospital_count, ""], ["Schools", b.essential_services?.school_count, ""],
        ["Bus stops", b.public_transport?.bus_stop_count, ""], ["Metro", b.public_transport?.metro_station_count, ""],
        ["Park area", b.green?.park_area_km2, "km²"], ["Nightlights", b.night?.nightlight_mean, ""],
        ["Elevation", b.terrain?.elevation_mean, "m"], ["PM2.5", b.air?.pm25, "µg/m³"],
      ].filter(([, v]) => v !== null && v !== undefined);

      $("#cell-detail-content").innerHTML = `
        <div class="score-hero">
          <div class="muted">Grid #${b.grid_id} · ${fmt(b.latitude, 4)}, ${fmt(b.longitude, 4)}</div>
          <div class="big" style="color:${color}">${fmt(s.urban_usability_score)}</div>
          <span class="cls" style="background:${color}">${esc(cls)}</span>
        </div>
        <div class="radar-wrap"><canvas id="radar-chart" width="300" height="220"></canvas></div>
        <div class="bundle-card">
          <h4>Key Metrics</h4>
          ${metrics.map(([k, v, u]) => `<div class="kv"><span class="k">${k}</span><span class="v">${fmt(v, 2)} ${u}</span></div>`).join("")}
        </div>`;
      $("#cell-detail").classList.remove("hidden");

      const ctx = document.getElementById("radar-chart");
      if (radarChart) radarChart.destroy();
      radarChart = new Chart(ctx, {
        type: "radar",
        data: {
          labels: radarData.map(([l]) => l),
          datasets: [{
            label: "sub-scores (0-100)",
            data: radarData.map(([, v]) => v ?? 0),
            borderColor: color, backgroundColor: color.replace("rgb", "rgba").replace(")", ",0.25)"),
            pointBackgroundColor: color, borderWidth: 2,
          }],
        },
        options: {
          scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, color: "#8ea0bf" }, grid: { color: "#263355" }, angleLines: { color: "#263355" }, pointLabels: { color: "#e6ecf7", font: { size: 11 } } } },
          plugins: { legend: { display: false } },
        },
      });
    } catch (e) {
      $("#cell-detail-content").innerHTML = `<div class="error">${esc(e.message)}</div>`;
      $("#cell-detail").classList.remove("hidden");
    }
  }

  $("#cell-detail-close").addEventListener("click", () => $("#cell-detail").classList.add("hidden"));

  /* map search */
  $("#map-search").addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const q = $("#map-search").value.trim();
    if (!q) return;
    try {
      const res = await api(`/search?q=${encodeURIComponent(q)}&limit=1`);
      if (!res.length) throw new Error("No cell found");
      const c = res[0];
      map.flyTo([c.latitude, c.longitude], 14);
      setTimeout(() => openCellDetail(c.grid_id), 500);
    } catch (err) { alert(err.message); }
  });

  /* ============ Explore view ============ */
  async function loadExplore(gridId) {
    const box = $("#explore-result");
    $("#explore-error").classList.add("hidden");
    box.classList.remove("hidden");
    box.innerHTML = `<div class="panel">Loading grid #${gridId}…</div>`;
    try {
      const b = await api(`/grids/${gridId}/bundle`);
      const s = b.scores || {};
      const cls = s.usability_class || "No score";
      const color = CLASS_COLORS[cls] || "#8ea0bf";

      const scoreCards = [
        ["Heat", s.heat_score], ["Walkability", s.walkability_score], ["Traffic", s.traffic_score],
        ["Flood Risk", s.flood_score], ["Air Quality", s.air_quality_score], ["Accessibility", s.accessibility_score],
        ["Transit", s.transit_score], ["Services", s.services_score], ["Environment", s.environment_score],
      ];

      const groupCards = (name, obj) => {
        if (!obj) return "";
        const entries = Object.entries(obj).filter(([k]) => k !== "grid_id" && obj[k] !== null && obj[k] !== undefined);
        if (!entries.length) return "";
        return `<div class="bundle-card"><h4>${name}</h4>${entries.map(([k, v]) => `<div class="kv"><span class="k">${k.replace(/_/g, " ")}</span><span class="v">${fmt(v, 2)}</span></div>`).join("")}</div>`;
      };

      const groups = [
        ["Heat", b.heat], ["Vegetation", b.vegetation], ["Weather", b.weather], ["Terrain", b.terrain],
        ["Air", b.air], ["Population", b.population], ["Night", b.night], ["Water", b.water],
        ["Roads", b.roads], ["Traffic", b.traffic], ["Vehicles", b.vehicles], ["Walkability", b.walkability],
        ["Buildings", b.buildings], ["Green", b.green], ["Drainage", b.drainage],
        ["Public Transport", b.public_transport], ["Essential Services", b.essential_services], ["Commercial", b.commercial],
      ];

      box.innerHTML = `
        <div class="panel">
          <h2>Grid #${b.grid_id} <span class="muted">· ${fmt(b.latitude, 4)}, ${fmt(b.longitude, 4)}</span></h2>
          <div class="score-hero" style="text-align:left; margin:12px 0;">
            <div class="big" style="color:${color}">${fmt(s.urban_usability_score)} <small style="font-size:14px; color:var(--muted)">/ 100</small></div>
            <span class="cls" style="background:${color}">${esc(cls)}</span>
          </div>
          <div class="score-cards">
            ${scoreCards.map(([l, v]) => {
              const val = v ?? 0;
              const c = scoreColor(val);
              return `<div class="score-card"><div class="label">${l}</div><div class="val">${fmt(val)}</div><div class="bar"><div style="width:${val}%;background:${c}"></div></div></div>`;
            }).join("")}
          </div>
          <div class="bundle-grid">
            ${groups.map(([n, o]) => groupCards(n, o)).join("")}
          </div>
        </div>`;
    } catch (e) {
      $("#explore-error").textContent = "Error: " + e.message;
      $("#explore-error").classList.remove("hidden");
      box.classList.add("hidden");
    }
  }

  $("#explore-btn").addEventListener("click", () => {
    const v = parseInt($("#explore-input").value, 10);
    if (!v) { $("#explore-error").textContent = "Enter a grid ID"; $("#explore-error").classList.remove("hidden"); return; }
    loadExplore(v);
  });
  $("#explore-input").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#explore-btn").click(); });

  /* ============ Map export ============ */
  $("#map-export").addEventListener("click", async () => {
    const btn = $("#map-export");
    btn.disabled = true;
    btn.textContent = "Rendering…";
    try {
      const canvas = await html2canvas($("#map"), { backgroundColor: "#0d1526", useCORS: true });
      const link = document.createElement("a");
      link.download = "urban_shadow_map.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      alert("Export failed: " + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "📷 Export PNG";
    }
  });

  /* ============ Compare view ============ */
  let cmpChart = null;
  async function compareCells(a, b) {
    const box = $("#cmp-result");
    $("#cmp-error").classList.add("hidden");
    box.classList.remove("hidden");
    box.innerHTML = `<div class="panel">Loading cells ${a} vs ${b}…</div>`;
    try {
      const [A, B] = await Promise.all([api(`/grids/${a}/bundle`), api(`/grids/${b}/bundle`)]);
      const sa = A.scores || {}, sb = B.scores || {};
      const axes = ["heat_score", "walkability_score", "traffic_score", "flood_score", "air_quality_score",
                    "accessibility_score", "transit_score", "services_score", "environment_score"];
      const labels = ["Heat", "Walk", "Traffic", "Flood", "Air", "Access", "Transit", "Services", "Env"];
      const ca = CLASS_COLORS[sa.usability_class] || "#4f8cff";
      const cb = CLASS_COLORS[sb.usability_class] || "#38d39f";

      box.innerHTML = `
        <div class="panel">
          <h2>${a} <span class="muted">vs</span> ${b}</h2>
          <div class="cmp-cards">
            <div class="cmp-card" style="border-color:${ca}">
              <div class="muted">Cell #${A.grid_id} · ${fmt(A.latitude,3)}, ${fmt(A.longitude,3)}</div>
              <div class="big" style="color:${ca}">${fmt(sa.urban_usability_score)}</div>
              <span class="cls" style="background:${ca}">${esc(sa.usability_class)}</span>
            </div>
            <div class="cmp-card" style="border-color:${cb}">
              <div class="muted">Cell #${B.grid_id} · ${fmt(B.latitude,3)}, ${fmt(B.longitude,3)}</div>
              <div class="big" style="color:${cb}">${fmt(sb.urban_usability_score)}</div>
              <span class="cls" style="background:${cb}">${esc(sb.usability_class)}</span>
            </div>
          </div>
          <div class="cmp-radar"><canvas id="cmp-radar" width="420" height="260"></canvas></div>
        </div>`;

      const ctx = document.getElementById("cmp-radar");
      if (cmpChart) cmpChart.destroy();
      cmpChart = new Chart(ctx, {
        type: "radar",
        data: {
          labels,
          datasets: [
            { label: `Cell ${a}`, data: axes.map((x) => sa[x] ?? 0), borderColor: ca, backgroundColor: ca.replace("rgb", "rgba").replace(")", ",0.2)"), pointBackgroundColor: ca, borderWidth: 2 },
            { label: `Cell ${b}`, data: axes.map((x) => sb[x] ?? 0), borderColor: cb, backgroundColor: cb.replace("rgb", "rgba").replace(")", ",0.2)"), pointBackgroundColor: cb, borderWidth: 2 },
          ],
        },
        options: {
          scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, color: "#8ea0bf" }, grid: { color: "#263355" }, angleLines: { color: "#263355" }, pointLabels: { color: "#e6ecf7", font: { size: 11 } } } },
          plugins: { legend: { position: "bottom", labels: { color: "#e6ecf7" } } },
        },
      });
    } catch (e) {
      $("#cmp-error").textContent = "Error: " + e.message;
      $("#cmp-error").classList.remove("hidden");
      box.classList.add("hidden");
    }
  }

  $("#cmp-btn").addEventListener("click", () => {
    const a = parseInt($("#cmp-a").value, 10), b = parseInt($("#cmp-b").value, 10);
    if (!a || !b) { $("#cmp-error").textContent = "Enter both grid IDs"; $("#cmp-error").classList.remove("hidden"); return; }
    compareCells(a, b);
  });

  /* ============ ML view ============ */
  const FEATURE_DEFS = [
    ["lst_mean", "LST mean (°C)", 43.8], ["lst_summer_mean", "LST summer (°C)", 45.0],
    ["ndvi_mean", "NDVI", 0.22], ["builtup_percentage", "Built-up (%)", 0.64],
    ["humidity", "Humidity (%)", 50], ["wind_speed", "Wind (m/s)", 5],
    ["annual_rainfall", "Annual rain (mm)", 700], ["max_day_rainfall", "Max day rain (mm)", 80], ["max_monsoon_rainfall", "Monsoon rain (mm)", 350],
    ["elevation_mean", "Elevation mean (m)", 220], ["elevation_min", "Elevation min (m)", 210], ["elevation_max", "Elevation max (m)", 235],
    ["pm25", "PM2.5 (µg/m³)", 90], ["pm10", "PM10 (µg/m³)", 180], ["no2", "NO2", 40], ["o3", "O3", 60],
    ["population", "Population", 5000], ["population_density", "Density (km²)", 20000],
    ["nightlight_mean", "Nightlight", 40],
    ["water_occurrence", "Water occurrence (%)", 0], ["surface_water_occurrence", "Surface water (%)", 0],
    ["road_length_km", "Road length (km)", 20], ["major_road_length_km", "Major road (km)", 2], ["intersection_count", "Intersections", 50],
    ["traffic_signal_count", "Traffic signals", 5],
    ["parking_count", "Parking spots", 5], ["fuel_station_count", "Fuel stations", 1],
    ["footway_length_km", "Footways (km)", 2], ["cycleway_length_km", "Cycleways (km)", 0.5], ["crossing_count", "Crossings", 20],
    ["pedestrian_area_km2", "Pedestrian area (km²)", 0.1], ["steps_count", "Steps", 50],
    ["building_count", "Buildings", 200], ["building_area_km2", "Building area (km²)", 0.2],
    ["park_area_km2", "Park area (km²)", 0.1],
    ["drain_length_km", "Drains (km)", 3],
    ["bus_stop_count", "Bus stops", 5], ["metro_station_count", "Metro stations", 1], ["transit_count", "Transit stops", 8],
    ["hospital_count", "Hospitals", 2], ["school_count", "Schools", 3], ["pharmacy_count", "Pharmacies", 2],
    ["police_count", "Police stations", 1], ["public_toilet_count", "Public toilets", 2],
    ["commercial_area_km2", "Commercial (km²)", 0.1], ["industrial_area_km2", "Industrial (km²)", 0.05], ["retail_area_km2", "Retail (km²)", 0.05],
  ];

  function buildMLForm() {
    $("#ml-form").innerHTML = FEATURE_DEFS.map(([name, label, def]) =>
      `<div class="ml-field"><label>${esc(label)}</label><input type="number" step="any" data-feat="${name}" value="${def}" /></div>`
    ).join("");
  }

  function collectFeatures() {
    const payload = {};
    document.querySelectorAll("#ml-form input[data-feat]").forEach((inp) => {
      payload[inp.dataset.feat] = inp.value === "" ? 0 : parseFloat(inp.value);
    });
    return payload;
  }

  async function predictML() {
    const box = $("#ml-result");
    try {
      const payload = collectFeatures();
      box.classList.remove("hidden");
      box.innerHTML = `<div class="panel">Predicting…</div>`;
      const r = await api("/score/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const color = CLASS_COLORS[r.usability_class] || "#8ea0bf";
      box.innerHTML = `
        <div class="ml-result-card">
          <div>
            <div class="muted">Predicted Usability Score</div>
            <div class="big" style="color:${color}">${fmt(r.urban_usability_score)}</div>
          </div>
          <div class="cls" style="color:${color}">${esc(r.usability_class)}</div>
        </div>`;
    } catch (e) {
      box.classList.remove("hidden");
      box.innerHTML = `<div class="error">${esc(e.message)}</div>`;
    }
  }

  function fillFromBestCell() {
    api("/stats").then((s) => s.best && loadIntoMLForm(s.best.grid_id)).catch(() => {});
  }

  async function loadIntoMLForm(gridId) {
    try {
      const b = await api(`/grids/${gridId}/bundle`);
      const map = {
        ...(b.heat || {}), ...(b.vegetation || {}), ...(b.weather || {}), ...(b.terrain || {}),
        ...(b.air || {}), ...(b.population || {}), ...(b.night || {}), ...(b.water || {}),
        ...(b.roads || {}), ...(b.traffic || {}), ...(b.vehicles || {}), ...(b.walkability || {}),
        ...(b.buildings || {}), ...(b.green || {}), ...(b.drainage || {}),
        ...(b.public_transport || {}), ...(b.essential_services || {}), ...(b.commercial || {}),
      };
      document.querySelectorAll("#ml-form input[data-feat]").forEach((inp) => {
        const v = map[inp.dataset.feat];
        if (v !== null && v !== undefined) inp.value = v;
      });
    } catch (e) { console.error(e); }
  }

  $("#ml-predict-btn").addEventListener("click", predictML);
  $("#ml-reset-btn").addEventListener("click", () => {
    FEATURE_DEFS.forEach(([name, , def]) => {
      const inp = document.querySelector(`#ml-form input[data-feat="${name}"]`);
      if (inp) inp.value = def;
    });
  });

  /* ============ Init ============ */
  loadStats();
  initMap();
  buildMLForm();
  setTimeout(fillFromBestCell, 800);
})();