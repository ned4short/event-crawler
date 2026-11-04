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

# Small cities inside San Antonio share San Antonio ZIP codes in the data, and a few
# well-known neighborhoods people search by; add them by hand.
EXTRA = {"windcrest": [29.5155, -98.3803], "alamo heights": [29.4847, -98.4659], "balcones heights": [29.4888, -98.5503], "castle hills": [29.523, -98.5197], "leon valley": [29.4952, -98.6186], "kirby": [29.4636, -98.3856], "terrell hills": [29.4802, -98.4486], "olmos park": [29.4741, -98.4867], "shavano park": [29.5852, -98.5525], "hill country village": [29.5819, -98.4917], "hollywood park": [29.6003, -98.4867], "live oak": [29.5652, -98.3364], "converse": [29.518, -98.3161], "grey forest": [29.6155, -98.6806], "china grove": [29.3916, -98.3453], "st hedwig": [29.4144, -98.2014], "saint hedwig": [29.4144, -98.2014], "elmendorf": [29.2558, -98.3328], "stone oak": [29.64, -98.485], "alamo ranch": [29.488, -98.732], "medical center": [29.507, -98.577], "the pearl": [29.4428, -98.48], "pearl": [29.4428, -98.48], "southtown": [29.412, -98.495], "la cantera": [29.595, -98.618], "the rim": [29.605, -98.606], "downtown": [29.4241, -98.4936], "downtown san antonio": [29.4241, -98.4936]}
for k, v in EXTRA.items():
    cities.setdefault(k, v)

DATA.mkdir(exist_ok=True)
(DATA / "tx-zips.json").write_text(json.dumps(zips, separators=(",", ":")))
(DATA / "tx-cities.json").write_text(json.dumps(cities, separators=(",", ":")))
print(f"{len(zips)} ZIP codes, {len(cities)} cities")
