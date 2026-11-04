"""Build the pre-filled "This weekend", "This week" and "This month" pages.

Runs on a schedule (GitHub Actions, .github/workflows/build-pages.yml). It reads the
published "Event Crawler" Google Sheet, then writes:

    this-weekend/index.html   this-week/index.html   this-month/index.html

Each page is a copy of index.html with its own title and description, and with the
matching events already written into the page, so search engines can read them.
Once a visitor's browser loads the page, app.js takes over and keeps it live.

    python tools/build_pages.py              # reads the sheet link from index.html
    python tools/build_pages.py rows.csv     # or from a local CSV (for testing)
"""
import csv
import html
import io
import json
import math
import re
import sys
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://boredbandit.nedwebservices.com"
TZ = ZoneInfo("America/Chicago")
DOWNTOWN = (29.4241, -98.4936)
DEFAULT_RADIUS = 20  # miles, same default as the site
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]

ARROW = ('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
         'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
         '<path d="M5 12h14M13 6l6 6-6 6"/></svg>')


# ---------- reading the sheet (same rules as app.js) ----------
def norm_date(v):
    v = (v or "").strip()
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", v)
    if m:
        return f"{m[1]}-{int(m[2]):02d}-{int(m[3]):02d}"
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", v)
    if m:
        y = m[3] if len(m[3]) == 4 else "20" + m[3]
        return f"{y}-{int(m[1]):02d}-{int(m[2]):02d}"
    return ""


def norm_time(v):
    v = (v or "").strip().upper().replace(".", "")
    m = re.match(r"^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([AP]M)?$", v)
    if not m:
        return v
    h, mm, ap = int(m[1]), m[2] or "00", m[3]
    if not ap:
        ap = "PM" if h >= 12 else "AM"
        h = h % 12 or 12
    return f"{h}:{mm} {ap}"


def minutes(t):
    m = re.match(r"^(\d{1,2}):(\d{2})\s*([AP]M)$", (t or "").strip(), re.I)
    if not m:
        return 24 * 60
    h = int(m[1]) % 12 + (12 if m[3].upper() == "PM" else 0)
    return h * 60 + int(m[2])


def miles(a, b):
    r = 3958.8
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    x = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(x))


def load_events(text):
    rows = list(csv.reader(io.StringIO(text.lstrip("﻿"))))
    head = [h.strip().lower() for h in rows[0]]
    col = {k: (head.index(n) if n in head else -1) for k, n in {
        "date": "date", "time": "time", "name": "event name", "venue": "venue name", "address": "address",
        "city": "city", "state": "state", "zip": "zip code", "organizer": "organizer name", "price": "price",
        "link": "link", "lat": "latitude", "lng": "longitude"}.items()}
    zips = json.loads((ROOT / "data" / "tx-zips.json").read_text())
    cities = json.loads((ROOT / "data" / "tx-cities.json").read_text())

    def get(r, k):
        i = col[k]
        return r[i].strip() if 0 <= i < len(r) and r[i] else ""

    seen, out = set(), []
    for r in rows[1:]:
        e = {"date": norm_date(get(r, "date")), "time": norm_time(get(r, "time")), "name": get(r, "name"),
             "venue": get(r, "venue"), "address": get(r, "address"), "city": get(r, "city"),
             "state": get(r, "state") or "TX", "zip": get(r, "zip")[:5], "organizer": get(r, "organizer"),
             "price": get(r, "price"), "link": get(r, "link")}
        if not e["date"] or not e["name"]:
            continue
        key = (e["date"], e["time"], e["name"].lower())
        if key in seen:
            continue
        seen.add(key)
        try:
            e["pos"] = (float(get(r, "lat")), float(get(r, "lng")))
        except ValueError:
            if e["zip"] in zips:
                e["pos"] = tuple(zips[e["zip"]])
            elif e["city"].lower() in cities:
                e["pos"] = tuple(cities[e["city"].lower()])
        out.append(e)
    return out


# ---------- the three date ranges (same rules as app.js) ----------
def short(d):
    return f"{DAYS[d.weekday()][:3]}, {MONTHS[d.month - 1][:3]} {d.day}"


def long(d):
    return f"{DAYS[d.weekday()]}, {MONTHS[d.month - 1]} {d.day}"


def ranges(today):
    wd = today.weekday()  # Monday = 0 ... Sunday = 6
    if wd == 6:
        sat, wk_from = today - timedelta(days=1), today
    else:
        sat = today + timedelta(days=5 - wd) if wd < 5 else today
        wk_from = sat
    sun = sat + timedelta(days=1)
    week_end = today + timedelta(days=6 - wd)
    nxt = date(today.year + (today.month == 12), today.month % 12 + 1, 1)
    month_end = nxt - timedelta(days=1)
    return {
        "weekend": {"slug": "this-weekend", "from": wk_from, "to": sun, "label": "this weekend",
                    "title": "This weekend", "dates": f"{short(sat)} – {short(sun)}"},
        "week": {"slug": "this-week", "from": today, "to": week_end, "label": "this week",
                 "title": "This week", "dates": f"{short(today)} – {short(week_end)}"},
        "month": {"slug": "this-month", "from": today, "to": month_end, "label": "this month",
                  "title": "This month", "dates": f"{short(today)} – {short(month_end)}",
                  "month": MONTHS[today.month - 1]},
    }


# ---------- writing the event cards (same markup as app.js) ----------
def esc(s):
    return html.escape(s or "", quote=True)


def is_free(p):
    return bool(re.match(r"^free\b", (p or "").strip(), re.I))


def card(e):
    parts = (e["time"] or "").split(" ")
    t = f'<b>{esc(parts[0] or "TBA")}</b>' + (f"<small>{esc(parts[1])}</small>" if len(parts) > 1 else "")
    addr = esc(", ".join(x for x in (e["address"], e["city"]) if x))
    if e["zip"]:
        addr += f'<span class="zip">, {esc(e["state"])} {esc(e["zip"])}</span>'
    if e["organizer"]:
        addr += f'<span class="org"> · Hosted by {esc(e["organizer"])}</span>'
    acts = ""
    if e.get("mi") is not None:
        dist = "&lt; 0.1" if e["mi"] < 0.1 else f'{e["mi"]:.1f}'
        acts += f'<span class="dist-tag">{dist} mi</span>'
    if e["price"]:
        acts += f'<span class="price{" free" if is_free(e["price"]) else ""}">{esc(e["price"])}</span>'
    if re.match(r"^https?://", e["link"] or "", re.I):
        acts += (f'<a class="details" href="{esc(e["link"])}" target="_blank" rel="noopener nofollow" '
                 f'aria-label="Details for {esc(e["name"])}">Details{ARROW}</a>')
    venue = f'<p class="venue">{esc(e["venue"])}</p>' if e["venue"] else ""
    return (f'<article class="event"><div class="time">{t}</div><div class="info"><h4>{esc(e["name"])}</h4>'
            f'{venue}<p class="addr">{addr}</p></div><div class="actions">{acts}</div></article>')


def list_html(events):
    if not events:
        return ('<div class="empty"><p class="big">No events found yet</p><p class="muted">Our crawler adds new '
                'events every day. Try another date, a wider distance, or clear your search.</p></div>')
    out, last = [], None
    for e in events:
        if e["date"] != last:
            if last is not None:
                out.append("</section>")
            last = e["date"]
            d = date.fromisoformat(e["date"])
            out.append(f'<section class="group"><h3><span class="dot afternoon"></span>{esc(long(d))}</h3>')
        out.append(card(e))
    out.append("</section>")
    return "\n".join(out)


# ---------- event tags for Google (schema.org Event structured data) ----------
def iso_start(e):
    d = date.fromisoformat(e["date"])
    m = minutes(e["time"])
    if m >= 24 * 60:
        return e["date"]
    dt = datetime(d.year, d.month, d.day, m // 60, m % 60, tzinfo=TZ)
    return dt.isoformat()


def offer(e):
    p = (e["price"] or "").strip()
    if not p:
        return None
    o = {"@type": "Offer", "priceCurrency": "USD"}
    if is_free(p):
        o["price"] = "0"
    else:
        m = re.search(r"\$\s*(\d+(?:\.\d{1,2})?)", p)
        if not m:
            return None
        o["price"] = m[1]
    if re.match(r"^https?://", e["link"] or "", re.I):
        o["url"] = e["link"]
    return o


def event_tag(e):
    street = e["address"] or ""
    addr = {"@type": "PostalAddress", "streetAddress": street, "addressLocality": e["city"] or "San Antonio",
            "addressRegion": e["state"] or "TX", "addressCountry": "US"}
    if e["zip"]:
        addr["postalCode"] = e["zip"]
    where = e["venue"] or ", ".join(x for x in (street, e["city"]) if x) or "San Antonio"
    t = {
        "@type": "Event",
        "name": e["name"],
        "startDate": iso_start(e),
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {"@type": "Place", "name": where, "address": addr},
        "description": f"{e['name']} at {where}" + (f", {e['city']}" if e["city"] and e["city"] not in where else "") + ".",
    }
    if re.match(r"^https?://", e["link"] or "", re.I):
        t["url"] = e["link"]
    if e["organizer"]:
        t["organizer"] = {"@type": "Organization", "name": e["organizer"]}
    o = offer(e)
    if o:
        t["offers"] = o
    return t


def tags_html(events):
    if not events:
        return ""
    data = {"@context": "https://schema.org", "@graph": [event_tag(e) for e in events]}
    js = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return f'<script type="application/ld+json">{js}</script>\n'


# ---------- building the pages ----------
def build(template, events, today):
    for when, r in ranges(today).items():
        lo, hi = r["from"].isoformat(), r["to"].isoformat()
        picked = []
        for e in events:
            if not (lo <= e["date"] <= hi):
                continue
            e = dict(e)
            e["mi"] = miles(DOWNTOWN, e["pos"]) if e.get("pos") else None
            if e["mi"] is not None and e["mi"] > DEFAULT_RADIUS:
                continue
            picked.append(e)
        picked.sort(key=lambda e: (e["date"], minutes(e["time"])))
        n = len(picked)
        count = f"{n} event{'s' if n != 1 else ''}"
        url = f"{SITE}/{r['slug']}/"
        title = f"Things to Do in San Antonio {r['label'].title()} ({r['dates']}) – Bored Bandit"
        desc = (f"{count} in the San Antonio area {r['label']}, {r['dates']}: concerts, parties, markets, "
                f"classes and community events, updated every hour.")
        h1 = (f'Things to do in the <span class="hl">San Antonio area</span> {esc(r["label"])}'
              f'<span class="red">.</span>')
        heading = f'{r["title"]} · {r["dates"]}'
        summary = f"{count} within {DEFAULT_RADIUS} miles of downtown San Antonio"

        s = template
        s = s.replace("<head>", '<head>\n<base href="/">', 1)
        s = re.sub(r"<title>.*?</title>", f"<title>{esc(title)}</title>", s, count=1, flags=re.S)
        s = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{esc(desc)}">', s, count=1)
        s = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url}">', s, count=1)
        s = re.sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{url}">', s, count=1)
        s = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{esc(title)}">', s, count=1)
        s = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{esc(desc)}">', s, count=1)
        s = s.replace("</head>", tags_html(picked) + "</head>", 1)
        s = s.replace("<body>", f'<body data-when="{when}">', 1)
        s = re.sub(r"<h1>.*?</h1>", f"<h1>{h1}</h1>", s, count=1, flags=re.S)
        s = s.replace('<h2 id="heading">Today</h2>', f'<h2 id="heading">{esc(heading)}</h2>', 1)
        s = s.replace('<p id="summary" class="muted">Loading events…</p>', f'<p id="summary" class="muted">{esc(summary)}</p>', 1)
        s = s.replace('<div id="list" aria-live="polite"></div>', f'<div id="list" aria-live="polite">\n{list_html(picked)}\n</div>', 1)
        # The matching date button starts out selected.
        s = s.replace('data-when="today" aria-pressed="true"', 'data-when="today" aria-pressed="false"', 1)
        s = s.replace(f'data-when="{when}" aria-pressed="false"', f'data-when="{when}" aria-pressed="true"', 1)
        out = ROOT / r["slug"] / "index.html"
        out.parent.mkdir(exist_ok=True)
        old = out.read_text() if out.exists() else ""
        if old != s:
            out.write_text(s)
        print(f"/{r['slug']}/: {count} ({r['dates']}){'' if old != s else ' (unchanged)'}")


def main():
    template = (ROOT / "index.html").read_text()
    if len(sys.argv) > 1:
        text = Path(sys.argv[1]).read_text(encoding="utf-8")
    else:
        link = re.search(r"window\.EVENT_SHEET_CSV = '([^']+)'", template)[1]
        req = urllib.request.Request(link, headers={"User-Agent": "BoredBandit-PageBuilder"})
        text = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
    events = load_events(text)
    today = datetime.now(TZ).date()
    build(template, events, today)


if __name__ == "__main__":
    main()
