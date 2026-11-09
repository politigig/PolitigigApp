# Politigig App

A mobile app for Politigig, built as an installable web app (PWA). It works the way a native app does: four tabs, screens that switch in place, and a bottom sheet for details. On a computer it appears inside a phone-sized frame.

- **Home**: the "Welcome to the app" card, quick actions, the latest presidential result, the closest states, and shortcuts to the governor and Oklahoma results.
- **Services**: what Politigig offers campaigns. Tap a row to expand it.
- **Results**, with three modes:
  - **President**: interactive U.S. map (states or 3,100+ counties) for 2008–2024. You can tap, pinch-zoom and pan it. Tapping a state opens a bottom sheet with its results and margin history. Also includes popular-vote and electoral-vote charts, the closest states and a table of all states.
  - **Governor**: each state's most recent governor's race on a map, with a party tally, the closest 2026 races and a table of all states.
  - **Oklahoma**:
    - *Nov 3, 2026*: every race, including statewide offices, U.S. Senate and House, all 125 legislative seats, state questions and judicial retention.
    - *Past elections*: county maps colored by margin. Tap a county for its vote counts. Covers President 2008–2024, Governor 2010–2022 and U.S. Senate 2022. Below the map, every race result for that year from 2008 to 2024.
- **Account**: log in to the Politigig portal at https://app.politigig.com (customers only), install the app, and choose Light, Dark or Auto appearance.

There's no build step. It's static HTML, CSS and JS, and all libraries are vendored in `vendor/`, so it works offline once loaded.

## Run locally

```bash
python3 -m http.server 8080
```

Open http://localhost:8080. The page has to be served over HTTP, not opened as a file, because it `fetch`es its data.

## Deploy

Upload the folder to any static host (Netlify, Vercel, GitHub Pages, S3/CloudFront). `scripts/` and `.cache/` don't need to be uploaded. To ship it as a store app, wrap the hosted URL with Capacitor or a TWA (Android). The manifest and service worker already make it installable from the browser.

When you change files that the service worker caches, bump `CACHE` in `sw.js` (for example `politigig-v6` → `politigig-v7`) so installed copies pick up the update.

## Updating the election data

```bash
FRESH=1 scripts/update_data.sh
```

This re-downloads the governor and Oklahoma pages from Wikipedia and rebuilds the files in `data/`. Run it after new results are posted, for example once Oklahoma certifies its 2026 results. Wikipedia rate-limits requests, and the script waits and retries, so a fresh run can take about an hour. Without `FRESH=1`, it reuses pages already downloaded to `.cache/`.

The scripts check what they import:
- A county table is only used if its sums match the statewide result.
- A mistyped cell is only corrected when the row's own total and percentage confirm the fix.
- Races Wikipedia hasn't updated yet are marked "pending", never filled in.

Afterwards, review the changes with `git diff --stat data/` and bump the service worker cache version.

**Missing results** (not on Wikipedia yet), to add from official exports later:
- 21 of the 36 Nov 3, 2026 governor races
- Oklahoma 2026: Lt. Governor, Attorney General, Treasurer, Auditor, Superintendent, Labor, Insurance and Corporation Commission, plus vote counts for SQ 845 and SQ 847
- Oklahoma history: 2012 and 2016 Corporation Commission and state questions; 2014 Auditor, Insurance and Corporation Commission; 2024 state questions and House District 3; county tables for most U.S. Senate races

## Structure

| Path | Purpose |
|---|---|
| `index.html` | App shell, tabs and screens |
| `styles.css` | Theme tokens (brand colors, light/dark) and layout |
| `js/app.js` | Tab routing, services list (edit service text here), maps, charts, bottom sheet, settings |
| `js/elections-meta.js` | Candidates, certified electoral-vote totals, electors per state |
| `data/results.json` | Presidential vote totals: `{year: {states: {fips: [dem, rep, total]}, counties: {...}}}` |
| `data/governors.json` | Most recent governor race per state: `{ST: {year, status, candidates:[{name, party, votes, winner}], total, source}}` |
| `data/oklahoma-2026.json` | Oklahoma Nov 3, 2026 races, legislature, state questions, judicial retention |
| `data/oklahoma-history.json` | Oklahoma county results per race: `{races: [{id, year, office, dem, rep, state, counties: {fips: [dem, rep, total]}}]}` |
| `data/oklahoma-years.json` | Every Oklahoma statewide/federal race result per year, 2008–2024 |
| `data/counties-albers-10m.json` | U.S. map geometry (us-atlas) |
| `scripts/` | Data download and build scripts (`update_data.sh` runs them all) |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA / offline support |

## Data sources

- Presidential state totals 2008–2020: MIT Election Data and Science Lab (certified results).
- Presidential county results 2008–2024 and 2024 state totals: [tonmcg/US_County_Level_Election_Results_08-24](https://github.com/tonmcg/US_County_Level_Election_Results_08-24) (MIT License). The project says this data is not authoritative. Alaska is shown at the state level.
- Governor results and all Oklahoma race results: compiled from Wikipedia, which cites state election offices and the Oklahoma State Election Board. 2026 results are **unofficial** until certified.
- Map geometry: [us-atlas](https://github.com/topojson/us-atlas) (ISC).
