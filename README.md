# Politigig App Website

Mobile-first website and installable web app (PWA) for Politigig. It includes:

- **Services showcase**: what Politigig offers campaigns.
- **Portal login**: every "Log in" button links to https://app.politigig.com.
- **Election results explorer**: interactive U.S. map (states or 3,100+ counties) for the 2008–2024 presidential elections. You can tap, pinch-zoom and pan it. It also has national popular-vote and electoral-vote charts, a per-state margin history, a "closest states" list and a full table view.

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
| `index.html` | Page layout and copy (edit the services text here) |
| `styles.css` | Theme tokens (brand colors, light/dark) and layout |
| `js/app.js` | Map, charts, interactions |
| `js/elections-meta.js` | Candidates, certified electoral-vote totals, electors per state |
| `data/results.json` | Vote totals: `{year: {states: {fips: [dem, rep, total]}, counties: {...}}}` |
| `data/counties-albers-10m.json` | U.S. map geometry (us-atlas) |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA / offline support |

## Data sources

- State totals 2008–2020: MIT Election Data and Science Lab (certified results).
- County results 2008–2024 and 2024 state totals: [tonmcg/US_County_Level_Election_Results_08-24](https://github.com/tonmcg/US_County_Level_Election_Results_08-24) (MIT License). The project says this data is not authoritative. Alaska is shown at the state level.
- Map geometry: [us-atlas](https://github.com/topojson/us-atlas) (ISC).
