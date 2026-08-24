"""ONE-TIME builder for grid_id -> Delhi area/locality names.

Fetches real locality points (OSM place=suburb/town/village/neighbourhood)
inside NCT Delhi from the public Overpass API (no API key), then assigns each
existing grid centroid the nearest locality name. Result is cached to
backend/data/grid_area_names.csv so the backend never calls the network.

Usage:
    python scripts/build_area_names.py

Run once; re-run only to refresh names.
"""

import csv
import json
import os
import sys
import urllib.request
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET = os.path.join(BASE, "data", "delhi_final_dataset.csv")
OUT = os.path.join(BASE, "data", "grid_area_names.csv")

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
QUERY = """[out:json][timeout:90];
area["name"="Delhi"]["boundary"="administrative"]->.searchArea;
node["place"~"^(suburb|town|village|neighbourhood)$"](area.searchArea);
out body;
"""

# grids whose nearest locality is farther than this (degrees) get no name
MAX_DISTANCE_DEG = 0.05


def fetch_localities(local_json: str | None = None) -> list[tuple[str, float, float]]:
    if local_json:
        with open(local_json, "r", encoding="utf-8") as fh:
            payload = json.load(fh)
    else:
        body = urllib.parse.urlencode({"data": QUERY}).encode()
        req = urllib.request.Request(OVERPASS_URL, data=body, headers={"User-Agent": "urban-shadow-area-names/1.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            payload = json.load(resp)
    places = []
    for el in payload.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name")
        lat, lon = el.get("lat"), el.get("lon")
        if name and lat is not None and lon is not None:
            places.append((name, float(lat), float(lon)))
    return places


def main() -> None:
    import pandas as pd
    from scipy.spatial import cKDTree

    local_json = sys.argv[1] if len(sys.argv) > 1 else None
    df = pd.read_csv(DATASET, usecols=["grid_id", "latitude", "longitude"])
    print(f"grids: {len(df)}")

    print("fetching OSM localities for NCT Delhi (one request)...")
    places = fetch_localities(local_json)
    print(f"localities: {len(places)}")
    if not places:
        print("ERROR: no localities returned; aborting without writing cache")
        sys.exit(1)

    tree = cKDTree([(p[1], p[2]) for p in places])
    dists, idx = tree.query(list(zip(df["latitude"], df["longitude"])), k=1)

    rows = []
    unresolved = 0
    for gid, dist, i in zip(df["grid_id"], dists, idx):
        if dist <= MAX_DISTANCE_DEG:
            rows.append({"grid_id": str(gid), "area_name": places[int(i)][0]})
        else:
            unresolved += 1  # left unmapped -> backend serves "Area unavailable"
    with open(OUT, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=["grid_id", "area_name"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"mapped: {len(rows)} | unresolved (>~5km): {unresolved}")
    print(f"saved -> {OUT}")
    sample = df.head(3)["grid_id"].astype(str).tolist()
    lookup = {r["grid_id"]: r["area_name"] for r in rows}
    for gid in sample:
        print(f"  sample {gid} -> {lookup.get(str(gid), 'Area unavailable')}")


if __name__ == "__main__":
    main()
