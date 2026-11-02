# Event Crawler

Search local events in San Antonio by date (today, tomorrow, this weekend or any date) and distance (1, 5, 10, 20 or 40 miles).

Live site: https://eventcrawler.nedwebservices.com

## How it works

- `index.html`, `styles.css`, `app.js` – the site (plain HTML/CSS/JS, no build step).
- `data/events.json` – the events the site shows. It is built from the **Event Crawler** Google Sheet.
- `data/tx-zips.json` – Texas ZIP code locations, used when a visitor types a ZIP code.
- Distances are measured from the visitor's ZIP code or location (or downtown San Antonio by default) to each event's ZIP code.

## Updating events

1. Export the sheet (columns: Date, Time, Event Name, Venue Name, Address, City, State, Zip Code, Organizer Name, Price, Link) as CSV.
2. Run `pip install zipcodes` then `python tools/sync_events.py export.csv`.
3. Commit and push `data/events.json`. GitHub Pages updates the site in about a minute.

Dates must be `YYYY-MM-DD` and times like `7:30 PM`. Optional `Latitude` / `Longitude` columns give exact distances.

## Hosting

- GitHub Pages from the `main` branch of `ned4short/event-crawler`.
- Custom domain `eventcrawler.nedwebservices.com` (set in `CNAME`).
- DNS: a `CNAME` record for `eventcrawler` on nedwebservices.com pointing to `ned4short.github.io`.

© 2026 Ned Web Services. All rights reserved.
