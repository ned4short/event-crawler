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
    out, last, shown, ad_no = [], None, 0, 0
    for e in events:
        if e["date"] != last:
            if last is not None:
                out.append("</section>")
            last = e["date"]
            d = date.fromisoformat(e["date"])
            out.append(f'<section class="group"><h3><span class="dot afternoon"></span>{esc(long(d))}</h3>')
        out.append(card(e))
        shown += 1
        # Ned Ads slideshow: after event 15, then every 15 more, never within the last 10 (lists over 25 only).
        if len(events) > 25 and shown >= 15 and (shown - 15) % 15 == 0 and len(events) - shown >= 10:
            ad_no += 1
            out.append(f'<div class="inline-ads" data-ned-ads data-start="{ad_no}"></div>')
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
AREAS = [
    {"key": "san-antonio", "name": "San Antonio", "prefix": "", "center": (29.4241, -98.4936),
     "places": "from downtown and the Pearl to New Braunfels, Schertz and Helotes"},
    {"key": "austin", "name": "Austin", "prefix": "austin", "center": (30.2672, -97.7431),
     "places": "from downtown and South Congress to Round Rock, Georgetown, Pflugerville and San Marcos"},
    {"key": "corpus-christi", "name": "Corpus Christi", "prefix": "corpus-christi", "center": (27.8006, -97.3964),
     "places": "from downtown and the bayfront to Portland, Robstown, Port Aransas and North Padre Island"},
]
SA_PLACES = AREAS[0]["places"]


def area_url(area, slug=""):
    parts = [x for x in (area["prefix"], slug) if x]
    return f"{SITE}/" + "".join(p + "/" for p in parts)


def area_path(area, slug=""):
    parts = [x for x in (area["prefix"], slug) if x]
    return "/" + "".join(p + "/" for p in parts)


def area_template(template, area):
    """Turn the San Antonio home page into the same page for another area."""
    s = template
    if area["key"] == "san-antonio":
        return s
    name = area["name"]
    s = s.replace('data-area="san-antonio">', f'data-area="{area["key"]}">', 1)
    s = s.replace('<span class="area-current">San Antonio area</span>', f'<span class="area-current">{esc(name)} area</span>', 1)
    s = s.replace('<a href="/" data-area="san-antonio" aria-current="page">', '<a href="/" data-area="san-antonio">', 1)
    s = s.replace(f'<a href="/{area["prefix"]}/" data-area="{area["key"]}">', f'<a href="/{area["prefix"]}/" data-area="{area["key"]}" aria-current="page">', 1)
    home = area_path(area)
    # Date buttons and Browse links point to this area's pages.
    s = s.replace('<a href="/" class="chip when"', f'<a href="{home}" class="chip when"', 1)
    for slug in ("this-weekend", "this-week", "this-month"):
        s = s.replace(f'<a href="/{slug}/" class="chip when"', f'<a href="{area_path(area, slug)}" class="chip when"', 1)
        s = s.replace(f'<a href="/{slug}/">', f'<a href="{area_path(area, slug)}">')
    s = s.replace('<a href="/">Today in San Antonio</a>', f'<a href="{home}">Today in {esc(name)}</a>', 1)
    s = s.replace("from across the San Antonio area, " + SA_PLACES, f"from across the {name} area, " + area["places"], 1)
    s = s.replace('"description":"Search local events in San Antonio by date and distance."',
                  f'"description":"Search local events in the {name} area by date and distance."', 1)
    # Link previews (Facebook, X, texts) show this area's own image.
    s = s.replace("/og-image.png?v=2", f"/og-image-{area['key']}.png?v=1")
    s = re.sub(r"<h1>.*?</h1>", f'<h1>Find something to do in the <span class="hl">{esc(name)} area</span><span class="red">.</span></h1>', s, count=1, flags=re.S)
    return s


def write(path, s):
    out = ROOT / path.strip("/") / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    old = out.read_text() if out.exists() else ""
    if old != s:
        out.write_text(s)
    return old != s


def page(base, area, when, r, picked, page_title, desc, h1, url):
    n = len(picked)
    count = f"{n} event{'s' if n != 1 else ''}"
    heading = f'{r["title"]} · {r["dates"]}'
    summary = f"{count} within {DEFAULT_RADIUS} miles of downtown {area['name']}"
    s = base
    s = s.replace("<head>", '<head>\n<base href="/">', 1)
    s = re.sub(r"<title>.*?</title>", f"<title>{esc(page_title)}</title>", s, count=1, flags=re.S)
    s = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{esc(desc)}">', s, count=1)
    s = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url}">', s, count=1)
    s = re.sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{url}">', s, count=1)
    s = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{esc(page_title)}">', s, count=1)
    s = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{esc(desc)}">', s, count=1)
    s = s.replace("</head>", tags_html(picked) + "</head>", 1)
    s = s.replace("<body>", f'<body data-when="{when}">', 1)
    if h1:
        s = re.sub(r"<h1>.*?</h1>", f"<h1>{h1}</h1>", s, count=1, flags=re.S)
    s = s.replace('<h2 id="heading">Today</h2>', f'<h2 id="heading">{esc(heading)}</h2>', 1)
    s = s.replace('<p id="summary" class="muted">Loading events…</p>', f'<p id="summary" class="muted">{esc(summary)}</p>', 1)
    s = s.replace('<div id="list" aria-live="polite"></div>', f'<div id="list" aria-live="polite">\n{list_html(picked)}\n</div>', 1)
    if when != "today":
        s = s.replace('data-when="today" aria-pressed="true"', 'data-when="today" aria-pressed="false"', 1)
        s = s.replace(f'data-when="{when}" aria-pressed="false"', f'data-when="{when}" aria-pressed="true"', 1)
    return s, count


def pick(events, area, lo, hi):
    out = []
    for e in events:
        if not (lo <= e["date"] <= hi):
            continue
        e = dict(e)
        e["mi"] = miles(area["center"], e["pos"]) if e.get("pos") else None
        # Events with no known location only show in San Antonio, where the sheet started.
        if e["mi"] is None and area["key"] != "san-antonio":
            continue
        if e["mi"] is not None and e["mi"] > DEFAULT_RADIUS:
            continue
        out.append(e)
    out.sort(key=lambda e: (e["date"], minutes(e["time"])))
    return out


def build(template, events, today):
    urls = []
    for area in AREAS:
        name = area["name"]
        base = area_template(template, area)

        # The area's home page (San Antonio's home page is index.html itself, filled in by the browser).
        if area["key"] != "san-antonio":
            r = {"title": "Today", "dates": long(today)}
            picked = pick(events, area, today.isoformat(), today.isoformat())
            title = f"Bored Bandit – Things to Do in {name} Today"
            desc = (f"Find events happening in the {name} area today, tomorrow, this weekend or any date. "
                    f"Search concerts, markets, classes and community events near you, within 1 to 40 miles.")
            s, count = page(base, area, "today", r, picked, title, desc, None, area_url(area))
            changed = write(area_path(area), s)
            print(f"{area_path(area)}: {count} today{'' if changed else ' (unchanged)'}")
        urls.append((area_url(area), "daily"))

        for when, r in ranges(today).items():
            picked = pick(events, area, r["from"].isoformat(), r["to"].isoformat())
            n = len(picked)
            count = f"{n} event{'s' if n != 1 else ''}"
            title = f"Things to Do in {name} {r['label'].title()} ({r['dates']}) – Bored Bandit"
            desc = (f"{count} in the {name} area {r['label']}, {r['dates']}: concerts, parties, markets, "
                    f"classes and community events, updated every day.")
            h1 = (f'Things to do in the <span class="hl">{esc(name)} area</span> {esc(r["label"])}'
                  f'<span class="red">.</span>')
            url = area_url(area, r["slug"])
            s, _ = page(base, area, when, r, picked, title, desc, h1, url)
            changed = write(area_path(area, r["slug"]), s)
            urls.append((url, "daily"))
            print(f"{area_path(area, r['slug'])}: {count} ({r['dates']}){'' if changed else ' (unchanged)'}")

    # Sitemap: every area page plus the fixed pages.
    fixed = [(f"{SITE}/submit.html", "monthly"), (f"{SITE}/contact.html", "monthly")]
    rows = "".join(f"  <url><loc>{u}</loc><changefreq>{f}</changefreq></url>\n" for u, f in urls + fixed)
    sm = f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{rows}</urlset>\n'
    (ROOT / "sitemap.xml").write_text(sm)


def main():
    template = (ROOT / "index.html").read_text()
    if len(sys.argv) > 1:
        text = Path(sys.argv[1]).read_text(encoding="utf-8")
    else:
        link = re.search(r"window\.EVENT_SHEET_CSV = '([^']+)'", template)[1]
        req = urllib.request.Request(link, headers={"User-Agent": "BoredBandit-PageBuilder"})
        text = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
        # Same-site copy of the sheet. The browser falls back to it when the sheet
        # can't be reached (Google's crawler can't fetch the published sheet).
        (ROOT / "data" / "events.csv").write_text(text, encoding="utf-8")
    events = load_events(text)
    today = datetime.now(TZ).date()
    build(template, events, today)


if __name__ == "__main__":
    main()
