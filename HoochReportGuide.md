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

## Current state (v10, April 2026)

- Single file: `index.html` loads React 18 + Babel standalone from cdnjs and compiles JSX **in the browser on every load**. Readable source: `hooch-v10.jsx`.
- No build step, no tests. Persistence via `localStorage` (dam schedule entries).
- History: built iteratively in claude.ai chat (v1–v10). Many deployment failures came from hand-assembling the HTML; avoid repeating that.

## Data sources

| Data | Source | Notes |
|---|---|---|
| Flow, water temp | USGS — **currently** `waterservices.usgs.gov/nwis/iv` | **Being decommissioned Feb 22, 2027; degradation starts Nov 2026.** Migrate to `api.waterdata.usgs.gov/ogcapi/v1`. |
| Turbidity | USGS param `63680` (BacteriALERT stations) | Not yet used. Real measurement to replace the modeled clarity. |
| Weather | Open-Meteo forecast API | Currently one point (33.93, -84.35). Uses `apparent_temperature_*` for feels-like. Supports multiple locations per call. |
| Stocking | GA DNR weekly PDF: `https://georgiawildlife.com/sites/default/files/wrd/pdf/trout/Weekly_Stocking_Report.pdf` | Fetched via free CORS proxies + raw-byte scan. **Almost certainly never worked** (PDF text is compressed). Needs real PDF text extraction, ideally server-side. |
| Dam schedule | Manual entry. Source: `https://spatialdata.usace.army.mil/hydropower/` (select "Buford Dam / Lake Sidney Lanier"); hotline 770-945-1466 | Browser can't read the USACE page (CORS). A server-side fetch is untested and worth trying. |

USGS gauges and parameter codes:

- `02334430` Buford Dam (upper river)
- `02335000` Norcross / Medlock Bridge (mid river; has turbidity)
- `02335880` Powers Ferry (lower river; has turbidity; **not yet used**)
- `02336000` Atlanta / Paces Ferry (lower river; has turbidity)
- Params: discharge `00060`, water temp `00010` (°C, convert to °F), gage height `00065`, turbidity `63680`

## River model

13 access points with NPS river miles (GA River Guidebook): Buford Dam (349), Bowmans Is. (348), Hwy 20 (346), Settles Br. (344), McGinnis (340), Abbotts Br. (335), Medlock Br. (331), Jones Br. (328), Island Ford (320), Morgan Falls (313), Johnson Fy. (311), Powers Is. (307), Paces Mill (304). Full table, regs, and notes are in the `SPOTS` array in the source.

- **Pulse travel times** from Buford release are stored per spot (`pulse`, minutes). Values are **unverified estimates** (e.g., Hwy 20 = 50, Jones Br. = 390, Morgan Falls = 720).
- **Morgan Falls is run-of-river**, so Buford releases pass through to the lower river. Lower sites use the Buford schedule with roughly 12-hour travel. There is no separate Morgan Falls schedule.
- Delayed Harvest (lower river): Nov 1 – May 14, catch-and-release, single-hook artificial.

## Scoring rules (user requirements — preserve these)

- Use **real feels-like temperature** from the API, not a manual wind-chill formula.
- **Freezing feels-like + wind over 15 mph + freezing precipitation is about as bad as it gets: the day score must land below 4.** Penalties compound.
- Overcast (60–90% cloud, dry) is a **bonus** because it triggers hatches.
- Recent rain degrades clarity, and clarity recovers faster upstream (upper ~12–18 h, mid ~48 h, lower ~60–72 h) until real turbidity replaces this model.
- Spot rankings combine flow vs. wading limit, clarity, water temperature (trout optimum 50–65°F, heavy penalty above 68°F), stocking, dam pulse timing, weekend crowding, and condition-specific bonuses.
- Ranked list shows top 5 by default with an expand control to see all 13, each with up to 3 short reasons (e.g., "Ideal flow · Clear water · Stocked Wed").

## Known issues (from Oct 2026 review), in priority order

1. **USGS migration** to the new Water Data API before service degrades.
2. **On-River Mode alerts don't fire with the phone locked** (iOS suspends web GPS/timers). Fix: a "Set alarm" action that creates a calendar event alerting 30 min before the pulse reaches the chosen spot.
3. **Stocking parser is broken** (see Data sources).
4. **Pulse logic bug:** spots are marked "water high" for only 60 min after pulse arrival, then "falling limb." High water should last from arrival until generation end + travel time.
5. **Drive-time formula is wrong** (assumes 25 mph; shows Buford Dam at 68 min, realistically ~35–40). Replace with a static table of real drive times from home plus a "Directions" link to Maps.
6. Clarity is modeled from one rain gauge point; use measured turbidity instead.
7. Generation isn't auto-detected; the Buford gauge shows releases within minutes, so detect the step-up and propagate the pulse automatically. Keep manual entry for future releases.
8. Wading thresholds are fixed guesses and misfire on the Atlanta gauge. Compare each gauge to its own recent base flow instead.
9. Future-day rankings use today's flow as if it were known. Rank future days without flow, or label flow unknown.
10. Weather comes from one point. Pull upper/mid/lower separately.
11. Day score blends angler comfort with fish activity. Keep the headline rule above, but show "fish" and "comfort" subscores.

## Proposed v11 scope

Items 1–4 above, plus measured turbidity (6), auto-detected generation (7), relative flow thresholds (8), and a restructured build:

- Precompile instead of in-browser Babel.
- Split into modules: data, fetchers, scoring, UI.
- Add a small set of saved sample days (fixture data) to regression-test scoring.
- GitHub Action builds and deploys to Pages on push to `main`.

Travel-time calibration from historical USGS hydrographs can follow once the new API is wired in.

## Possible later work

- Small Cloudflare Worker on a schedule: parse stocking PDF, cache gauge data, test reading the USACE schedule server-side.
- Installable home-screen app (PWA) with last-known data cached for weak-signal access points.
- One-tap "how'd it fish (1–5)" after a trip, to calibrate scoring weights.
- Automated dam schedule via phone call + transcription (Twilio). **Parked**; don't build unless asked.

## Removed on purpose — don't reintroduce

- SVG fly illustrations (unreadable). Fly names link to Google Images search instead.
- Fish Log with camera (removed to simplify).

Candidates to remove, pending confirmation from the user: canvas share card (app is personal-only now) and the knots reference.

## UX conventions

- Layout: weekly day bar at top, large day detail below. Secondary features live in a hamburger slide-out menu, not tabs.
- Style: polished but restrained. Playfair Display for headings, JetBrains Mono for data, DM Sans for body. Forest green / cream / gold palette. Generous spacing, nothing below ~10px except timestamps.
- Mobile-first; the user mostly checks this on a phone.

## Working conventions

- Make changes on a branch and open a pull request; the user merges from GitHub.
- Before proposing a merge, confirm the build compiles and the app renders against both live data and fixture data.
- Never commit secrets. The repo is **public**, so keep personal details out of code and docs.
- When a change alters scoring behavior, state what changed and show before/after scores on the fixture days.
