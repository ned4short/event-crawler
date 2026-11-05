# Bored Bandit

Search local events in San Antonio by date (today, tomorrow, this weekend or any date) and distance (1, 5, 10, 20 or 40 miles).

Live site: https://boredbandit.nedwebservices.com

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
- Custom domain `boredbandit.nedwebservices.com` (set in `CNAME`).
- DNS: a `CNAME` record for `eventcrawler` on nedwebservices.com pointing to `ned4short.github.io`.

© 2026 Ned Web Services. All rights reserved.

## Event submissions

`submit.html` sends each submission (name, email, event link) to `https://www.ned4short.com/forms/event.php`, a PHP script on the ned4short.com GoDaddy hosting (`SUBMIT_URL` in `submit.html`). It emails nedu@nedairfilters.com with the subject "Bored Bandit Event Submission" and Reply-To set to the submitter, so the real address never appears on the site. The script only accepts requests from boredbandit.nedwebservices.com (and the old eventcrawler address).

## Advertisers

The advertiser slideshow below the footer comes from the shared Ned Ads widget (https://ads.nedwebservices.com, repo `ned4short/ned-ads`), so ads are managed in one place for every site. `advertise.html` forwards to the shared advertiser form there.

## Installable app (PWA)

- `manifest.webmanifest`, `icons/` and `sw.js` make the site installable on supported phones and computers (Chrome, Edge, Samsung Internet; iPhone/iPad via Share → Add to Home Screen).
- `install.js` shows a small banner in the red strip at the top: **Install** where the browser offers it, **Open app** when the app is already installed, and Add-to-Home-Screen tips on iPhone/iPad. The X hides it for 7 days, and the link /app (or any page with ?app) brings it back; it never shows inside the installed app.
- `sw.js` keeps the last copy of the events sheet, so the app still shows events on a weak or offline connection. When changing cached files, bump `VERSION` and the `?v=` numbers listed in it.

## Starred events

Each event has a star. Starred events are saved on the visitor's own device (browser storage, no account) and appear in a "Your starred events" section right below the search box, sorted by date and time. Past events drop off automatically. Starring doesn't move the page, and a short message confirms each star.

## This weekend / This week / This month pages

`/this-weekend/`, `/this-week/` and `/this-month/` are rebuilt 3 times a day (7 AM, 1 PM and 7 PM Central) by GitHub Actions (`.github/workflows/build-pages.yml` runs `tools/build_pages.py`). Each is a copy of `index.html` with its own title and description and with that range's events (within 20 miles of downtown) written into the page, so search engines can read them. In the browser, `app.js` then keeps the page live from the sheet. The date buttons on every page are real links to these pages, and a "Browse" line above the footer links to all of them. To rebuild right away: Actions tab → "Build event pages" → Run workflow.
