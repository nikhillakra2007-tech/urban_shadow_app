import warnings
warnings.filterwarnings("ignore")

import os
import sys

# ensure the bundled PROJ database is used (PostGIS ships an old proj.db that
# shadows rasterio's and breaks EPSG lookups)
proj_data = os.path.join(sys.prefix, "Lib", "site-packages", "rasterio", "proj_data")
if os.path.isdir(proj_data):
    os.environ["PROJ_DATA"] = proj_data
    os.environ["PROJ_LIB"] = proj_data

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import geopandas as gpd
import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.lines import Line2D
from sqlalchemy import create_engine, text

from app.config import settings

engine = create_engine(settings.database_url)

# pull grid geometry + score from DB
grid = gpd.read_postgis(
    text("""
        SELECT g.grid_id, g.latitude, g.longitude, g.geom,
               s.urban_usability_score, s.usability_class
        FROM urban_grid_master g
        JOIN urban_scores s ON s.grid_id = g.grid_id
    """),
    engine,
    geom_col="geom",
    crs="EPSG:3857",
)
grid = grid.to_crs("EPSG:4326")
grid["latitude"] = grid.geometry.centroid.y
grid["longitude"] = grid.geometry.centroid.x

# green->yellow->red colormap (0..100)
cmap = LinearSegmentedColormap.from_list(
    "usability",
    ["#d73027", "#fc8d59", "#fee08b", "#d9ef8b", "#91cf60", "#1a9850"],
)

fig, ax = plt.subplots(figsize=(12, 12), dpi=130)

grid.plot(
    ax=ax,
    column="urban_usability_score",
    cmap=cmap,
    vmin=20,
    vmax=80,
    edgecolor="none",
    legend=True,
    legend_kwds={"label": "Urban Usability Score (0-100)", "shrink": 0.6, "orientation": "horizontal"},
)

# basemap tiles (OSM) - best-effort; falls back to plain grid if offline
try:
    import contextily as ctx
    ctx.add_basemap(ax, crs="EPSG:4326", source=ctx.providers.CartoDB.Positron, alpha=0.55)
    print("basemap added")
except Exception as exc:
    print("basemap skipped:", type(exc).__name__)
    ax.set_facecolor("#e8eef7")

# mark top cells
top = grid.nlargest(5, "urban_usability_score")
ax.scatter(top["longitude"], top["latitude"], s=28, facecolors="none", edgecolors="black", linewidths=1.2, zorder=5)
for _, r in top.iterrows():
    ax.annotate(f"{r.grid_id}\n{r.urban_usability_score:.0f}", (r.longitude, r.latitude),
                textcoords="offset points", xytext=(6, 6), fontsize=8, zorder=6)

ax.set_title("Delhi 500m Urban Usability Heatmap (6284 grid cells)", fontsize=14)
ax.set_xlabel("Longitude")
ax.set_ylabel("Latitude")
ax.set_xlim(grid.total_bounds[0] - 0.02, grid.total_bounds[2] + 0.02)
ax.set_ylim(grid.total_bounds[1] - 0.02, grid.total_bounds[3] + 0.02)

out = "delhi_usability_map.png"
plt.tight_layout()
plt.savefig(out, dpi=130)
print("saved", out)

# also dump a CSV so it can be opened in QGIS/excel
csv_out = "delhi_usability_scores.csv"
grid[["grid_id", "latitude", "longitude", "urban_usability_score", "usability_class"]].to_csv(csv_out, index=False)
print("saved", csv_out, len(grid), "rows")

# class summary
print(grid["usability_class"].value_counts().to_string())