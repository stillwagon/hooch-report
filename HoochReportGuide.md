# Hooch Report — Project Guide for Claude Code

## What this is

A personal web app for deciding **when, where, and with what** to fly fish the Chattahoochee River tailwater below Buford Dam (Atlanta area). It answers three questions in order:

1. Which day this week is best? (weather + water scoring)
2. Where should I fish that day? (ranked access points)
3. What should I tie on? (condition-matched fly patterns)

**Personal use only.** One user, no accounts, no sharing features needed. Optimize for accuracy and reliability over polish or growth.

- Repo: `github.com/stillwagon/hooch-report`
- Live: `https://stillwagon.github.io/hooch-report/` (GitHub Pages, `main` branch, root)
- Home location for drive times: Dunwoody, GA (~33.946, -84.335)

## Current state (v11, October 2026)

- Vite + React, precompiled. `npm run dev` / `npm test` / `npm run build`. No in-browser Babel.
- Layout: `src/data` (river model, flies, travel times), `src/lib` (pure logic: scoring, pulse, generation detection, series, stocking parser, ICS), `src/fetchers` (USGS, Open-Meteo, same-origin data + optional Worker), `src/ui` (React).
- Tests: Vitest in `test/`. Saved sample days in `test/fixtures/days.json`; `npm run fixtures` prints v10-vs-v11 headline, fish and "you" scores.
- Deploy: `.github/workflows/deploy.yml` tests, fetches server-side data, builds and publishes to Pages on every push to `main` and every 3 hours. **Pages source must be set to "GitHub Actions"** (Settings → Pages).
- Server-side data: `scripts/fetch-data.mjs` runs in the deploy workflow and writes `data/stocking.json`, `data/extras.json` (BacteriALERT) and `data/probe.json` (what the USACE and BacteriALERT pages return to a server) next to the site.
- Optional Worker (`worker/`): caches USGS gauges and serves `alarm.ics`. Set repo variable `WORKER_URL` to enable it. The app works without it.
- PWA: manifest + service worker; last-known data cached in `localStorage`.
- Persistence: manual dam schedule entries (`hooch:schedule:v11`), data cache (`hooch:cache:v11`).

## Data sources

| Data | Source | Notes |
|---|---|---|
| Flow, water temp, turbidity | USGS Water Data OGC API, `api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items` (v1 tried next), legacy `waterservices.usgs.gov` as last fallback until Feb 22, 2027 | One request per site/param (11 per refresh, every 10 min). The working base is remembered. Worker cache reduces this to one request. |
| Turbidity / E. coli | USGS `63680` at Norcross, Powers Ferry, Atlanta; BacteriALERT page `ga.water.usgs.gov/bacteria/` | Turbidity drives measured clarity for today on the mid/lower river. E. coli is parsed best-effort at build time; otherwise a rough flag at ≥30 FNU. |
| Weather | Open-Meteo, one call with three points (upper Hwy 20, mid Jones Br., lower Powers Is.) | Each section scored separately; day headline = best section. |
| Stocking | GA DNR weekly PDF | Parsed in GitHub Actions with real PDF text extraction (unpdf) → `data/stocking.json`. Browser fallback (CORS proxy + lazy-loaded unpdf) if that file is missing or >3 days old. The UI shows the matched report lines. |
| Dam schedule | Releases **auto-detected** from the Buford gauge; manual entry for future releases. USACE page + hotline 770-945-1466 | `data/probe.json` records whether a server can read the USACE page and which data URLs it loads. |

USGS gauges and parameter codes:

- `02334430` Buford Dam (upper river)
- `02335000` Norcross / Medlock Bridge (mid river; has turbidity)
- `02335880` Powers Ferry (lower river; has turbidity; **not yet used**)
- `02336000` Atlanta / Paces Ferry (lower river; has turbidity)
- Params: discharge `00060`, water temp `00010` (°C, convert to °F), gage height `00065`, turbidity `63680`

## River model

13 access points with NPS river miles (GA River Guidebook): Buford Dam (349), Bowmans Is. (348), Hwy 20 (346), Settles Br. (344), McGinnis (340), Abbotts Br. (335), Medlock Br. (331), Jones Br. (328), Island Ford (320), Morgan Falls (313), Johnson Fy. (311), Powers Is. (307), Paces Mill (304). Full table, regs, and notes are in the `SPOTS` array in the source.

- **Pulse travel times** from Buford release are stored per spot (`pulse`, minutes). Values are **unverified estimates** (e.g., Hwy 20 = 50, Jones Br. = 390, Morgan Falls = 720) until calibrated. Run the **Calibrate travel times** workflow (Actions tab). It measures half-height rise and fall lags at Norcross, Powers Ferry and Atlanta across past releases and pushes `src/data/travel.js` to the `calibrate-travel` branch for review. Once calibrated, spot lags are interpolated by river mile and the "(est.)" labels go away.
- **High water** lasts from release start + lag until release end + tail lag; the falling limb ("prime time") is the 2 h after that. A release still running has no known end, so the spot stays high.
- **Flow at a spot** = nearest upstream gauge read `lag difference` minutes ago, compared with that gauge's own 7-day base flow (15th percentile): ≤1.3× at base, ≤1.8× slightly up, ≤3× up, more is blown. Future days show "Flow TBD" unless releases are entered for that day.
- **Drive times** are a static table from home (`drive` in `SPOTS`, off-peak estimates; correct them from experience). Each spot has a Directions link to Apple Maps with live traffic.
- **Morgan Falls is run-of-river**, so Buford releases pass through to the lower river. Lower sites use the Buford schedule with roughly 12-hour travel. There is no separate Morgan Falls schedule.
- Delayed Harvest (lower river): Nov 1 – May 14, catch-and-release, single-hook artificial.

## Scoring rules (user requirements — preserve these)

- Use **real feels-like temperature** from the API, not a manual wind-chill formula.
- **Freezing feels-like + wind over 15 mph + freezing precipitation is about as bad as it gets: the day score must land below 4.** Penalties compound.
- Overcast (60–90% cloud, dry) is a **bonus** because it triggers hatches.
- Recent rain degrades clarity, and clarity recovers faster upstream (upper ~12–18 h, mid ~48 h, lower ~60–72 h) until real turbidity replaces this model.
- Spot rankings combine flow vs. wading limit, clarity, water temperature (trout optimum 50–65°F, heavy penalty above 68°F), stocking, dam pulse timing, weekend crowding, and condition-specific bonuses.
- Ranked list shows top 5 by default with an expand control to see all 13, each with up to 3 short reasons (e.g., "Ideal flow · Clear water · Stocked Wed").

## Scoring (v11)

- Headline day score is the v10 rule set (now also counts WMO 56/57 freezing drizzle as freezing precipitation). Under it: **Fish** (clouds, clarity, rain; air temperature matters little in a 50s tailwater) and **You** (feels-like, wind, precipitation).
- Spot reasons put the pulse note first so it is never hidden.
- Clarity: measured turbidity (≤8 FNU clear, ≤20 clearing, ≤50 stained, ≤150 muddy) for today on mid/lower; rainfall model otherwise.
- Delayed Harvest uses the real dates (Nov 1 – May 14).

## Still open

- Travel times: run the calibration workflow and review the result. Gauge river miles in `GAUGES` are approximate.
- Drive times: the table is an estimate; adjust from real trips.
- BacteriALERT and USACE parsing: check `https://stillwagon.github.io/hooch-report/data/probe.json` after the first deploy and write real parsers against what comes back.
- New USGS API: query shape follows the published docs, but it hasn't been checked against the live service from this environment. If `Live Gauges` shows "USGS legacy" as the source, the OGC request needs adjusting. Consider an API key if rate limits bite.

## Possible later work

- Use live downstream gauges to confirm pulse arrival in real time (Norcross/Powers Ferry/Atlanta see the rise directly).
- One-tap "how'd it fish (1–5)" after a trip, to calibrate scoring weights.
- Automated dam schedule via phone call + transcription (Twilio). **Parked**; don't build unless asked.

## Removed on purpose — don't reintroduce

- SVG fly illustrations (unreadable). Fly names link to Google Images search instead.
- Fish Log with camera (removed to simplify).
- Canvas share card and the knots reference (removed in v11; personal use only).

## UX conventions

- Layout: weekly day bar at top, large day detail below. Secondary features live in a hamburger slide-out menu, not tabs.
- Style: polished but restrained. Playfair Display for headings, JetBrains Mono for data, DM Sans for body. Forest green / cream / gold palette. Generous spacing, nothing below ~10px except timestamps.
- Mobile-first; the user mostly checks this on a phone.

## Working conventions

- Make changes on a branch and open a pull request; the user merges from GitHub.
- Before proposing a merge, confirm the build compiles and the app renders against both live data and fixture data.
- Never commit secrets. The repo is **public**, so keep personal details out of code and docs.
- When a change alters scoring behavior, state what changed and show before/after scores on the fixture days.
