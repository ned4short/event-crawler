# Event Crawler

Search local events in San Antonio by date (today, tomorrow, this weekend or any date) and distance (1, 5, 10, 20 or 40 miles).

Live site: https://eventcrawler.nedwebservices.com

## How it works

- `index.html`, `styles.css`, `app.js` – the site (plain HTML/CSS/JS, no build step).
- The `EVENT_SHEET_CSV` line near the bottom of `index.html` – the link to the **Event Crawler** Google Sheet, published to the web as CSV. The site reads the sheet directly every time it loads, so new rows show up on their own (Google refreshes the published copy within about 5 minutes). When you change `app.js` or `styles.css`, bump the `?v=` number in `index.html` so browsers load the new file.
- `data/tx-zips.json`, `data/tx-cities.json` – Texas ZIP code and city locations, used for the distance filter. Rebuild with `tools/build_locations.py` when adding new states.
- Distances are measured from the visitor's ZIP code or location (or downtown San Antonio by default) to each event's ZIP code (or city, if the ZIP is blank).

## Sheet format

Columns (first row): Date, Time, Event Name, Venue Name, Address, City, State, Zip Code, Organizer Name, Price, Link.

- Date: `2026-11-02` or `11/2/2026`. Time: `7:30 PM` (or `19:30`).
- Rows missing a date or event name are skipped; exact duplicates are shown once.
- Optional `Latitude` and `Longitude` columns give exact distances.

## Hosting

- GitHub Pages from the `main` branch of `ned4short/event-crawler`.
- Custom domain `eventcrawler.nedwebservices.com` (set in `CNAME`).
- DNS: a `CNAME` record for `eventcrawler` on nedwebservices.com pointing to `ned4short.github.io`.

© 2026 Ned Web Services. All rights reserved.

## Event submissions

`submit.html` emails each submission (Submitter Name, Email, Event link) to the site owner with the subject "Event Crawler Event Submission", using FormSubmit (formsubmit.co, free, no account). The `SUBMIT_URL` line in `submit.html` uses the FormSubmit alias code, so the real email address never appears on the site.

## Advertisers

The advertiser slideshow below the footer comes from the shared Ned Ads widget (https://ads.nedwebservices.com, repo `ned4short/ned-ads`), so ads are managed in one place for every site. `advertise.html` forwards to the shared advertiser form there.
