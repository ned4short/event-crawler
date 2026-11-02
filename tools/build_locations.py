"""Rebuild the Texas ZIP code and city location tables the site uses for distances.

    pip install zipcodes
    python tools/build_locations.py

Only needed when adding a new state or city; the files are already in data/.
"""
import json
from pathlib import Path

import zipcodes

DATA = Path(__file__).resolve().parent.parent / "data"
STATE = "TX"

zips, sums = {}, {}
for z in zipcodes.filter_by(state=STATE):
    lat, lng = round(float(z["lat"]), 4), round(float(z["long"]), 4)
    if z["zip_code_type"] == "STANDARD":
        zips[z["zip_code"]] = [lat, lng]
    s = sums.setdefault(z["city"].lower(), [0.0, 0.0, 0])
    s[0] += lat; s[1] += lng; s[2] += 1
cities = {k: [round(a / n, 4), round(b / n, 4)] for k, (a, b, n) in sums.items()}

DATA.mkdir(exist_ok=True)
(DATA / "tx-zips.json").write_text(json.dumps(zips, separators=(",", ":")))
(DATA / "tx-cities.json").write_text(json.dumps(cities, separators=(",", ":")))
print(f"{len(zips)} ZIP codes, {len(cities)} cities")
