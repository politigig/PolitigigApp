# Politigig App Website

A mobile app for Politigig, built as an installable web app (PWA). It works the way a native app does: four tabs, screens that switch in place, and a bottom sheet for details. On a computer it appears inside a phone-sized frame.

- **Home**: welcome card with portal login, quick actions, the latest presidential result and the closest states.
- **Services**: what Politigig offers campaigns. Tap a row to expand it.
- **Results**: interactive U.S. map (states or 3,100+ counties) for the 2008–2024 presidential elections. You can tap, pinch-zoom and pan it. Tapping a state opens a bottom sheet with its results and its margin history. The tab also has popular-vote and electoral-vote charts, the closest states and a table of all states.
- **Account**: log in to the Politigig portal at https://app.politigig.com, install the app, and choose Light, Dark or Auto appearance.

There's no build step. It's static HTML, CSS and JS, and all libraries are vendored in `vendor/`, so it works offline once loaded.

## Run locally

```bash
python3 -m http.server 8080
```

Open http://localhost:8080. The page has to be served over HTTP, not opened as a file, because it `fetch`es its data.

## Deploy

Upload the folder to any static host (Netlify, Vercel, GitHub Pages, S3/CloudFront). To ship it as a store app, wrap the hosted URL with Capacitor or a TWA (Android). The manifest and service worker already make it installable from the browser.

## Structure

| Path | Purpose |
|---|---|
| `index.html` | App shell, tabs and screens |
| `styles.css` | Theme tokens (brand colors, light/dark) and layout |
| `js/app.js` | Tab routing, services list (edit service text here), map, charts, bottom sheet, settings |
| `js/elections-meta.js` | Candidates, certified electoral-vote totals, electors per state |
| `data/results.json` | Vote totals: `{year: {states: {fips: [dem, rep, total]}, counties: {...}}}` |
| `data/counties-albers-10m.json` | U.S. map geometry (us-atlas) |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA / offline support |

## Data sources

- State totals 2008–2020: MIT Election Data and Science Lab (certified results).
- County results 2008–2024 and 2024 state totals: [tonmcg/US_County_Level_Election_Results_08-24](https://github.com/tonmcg/US_County_Level_Election_Results_08-24) (MIT License). The project says this data is not authoritative. Alaska is shown at the state level.
- Map geometry: [us-atlas](https://github.com/topojson/us-atlas) (ISC).
