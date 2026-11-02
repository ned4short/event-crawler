"""Turn rows from the "Event Crawler" Google Sheet into data/events.json.

Usage:
    pip install zipcodes
    python tools/sync_events.py rows.json      # rows as a JSON array of arrays (header first)
    python tools/sync_events.py export.csv     # or the sheet downloaded as CSV

Each event gets map coordinates from its ZIP code (or its city, if the ZIP is
missing), which the site uses for the 1/5/10/20/40-mile distance filter.
If the sheet ever gets Latitude / Longitude columns, those are used instead.
"""
import csv
import json
import sys
from pathlib import Path

import zipcodes

ROOT = Path(__file__).resolve().parent.parent


def load_rows(path):
    p = Path(path)
    if p.suffix.lower() == ".csv":
        with p.open(newline="", encoding="utf-8") as f:
            return list(csv.reader(f))
    return json.loads(p.read_text(encoding="utf-8"))


def city_centers(state="TX"):
    sums = {}
    for z in zipcodes.filter_by(state=state):
        key = z["city"].lower()
        s = sums.setdefault(key, [0.0, 0.0, 0])
        s[0] += float(z["lat"]); s[1] += float(z["long"]); s[2] += 1
    return {k: (round(a / n, 4), round(b / n, 4)) for k, (a, b, n) in sums.items()}


def main(src):
    rows = load_rows(src)
    header = [h.strip().lower() for h in rows[0]]
    col = {name: i for i, name in enumerate(header)}

    def get(r, name):
        i = col.get(name)
        return r[i].strip() if i is not None and i < len(r) and r[i] else ""

    centers = city_centers()
    events, seen = [], set()
    for r in rows[1:]:
        if not any(c.strip() for c in r):
            continue
        ev = {
            "date": get(r, "date"),
            "time": get(r, "time"),
            "name": get(r, "event name"),
            "venue": get(r, "venue name"),
            "address": get(r, "address"),
            "city": get(r, "city"),
            "state": get(r, "state") or "TX",
            "zip": get(r, "zip code"),
            "organizer": get(r, "organizer name"),
            "price": get(r, "price"),
            "link": get(r, "link"),
        }
        if not ev["date"] or not ev["name"]:
            continue
        key = (ev["date"], ev["time"], ev["name"].lower())
        if key in seen:
            continue
        seen.add(key)

        lat, lng = get(r, "latitude"), get(r, "longitude")
        if lat and lng:
            ev["lat"], ev["lng"] = round(float(lat), 5), round(float(lng), 5)
        else:
            match = zipcodes.matching(ev["zip"]) if ev["zip"] else []
            if match:
                ev["lat"], ev["lng"] = round(float(match[0]["lat"]), 4), round(float(match[0]["long"]), 4)
            elif ev["city"].lower() in centers:
                ev["lat"], ev["lng"] = centers[ev["city"].lower()]
        events.append(ev)

    out = ROOT / "data" / "events.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(events, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    missing = sum(1 for e in events if "lat" not in e)
    print(f"Wrote {len(events)} events to {out.relative_to(ROOT)} ({missing} without a location)")

    zips = {z["zip_code"]: [round(float(z["lat"]), 4), round(float(z["long"]), 4)]
            for z in zipcodes.filter_by(state="TX") if z["zip_code_type"] == "STANDARD"}
    (ROOT / "data" / "tx-zips.json").write_text(json.dumps(zips, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "rows.json")
