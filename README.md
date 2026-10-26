# TipOff

TipOff shows St. Louis city staff the blocks where illegal dumping keeps coming back, when it usually gets reported, and a camera and cleanup plan for each one.

- **Live app:** https://tipoff-stl.vercel.app (no login)
- **Hotspot map:** [`/map`](https://tipoff-stl.vercel.app/map), where you tap a block to see its history
- **Crew board:** [`/crew`](https://tipoff-stl.vercel.app/crew), today's blocks to watch

Congressional App Challenge 2026 entry from Parkway West High School, St. Louis (Missouri's 2nd District).

| Student | Role |
| --- | --- |
| Prahlad Venugopalan | Lead developer: data pipeline, scoring, backend, iPhone app |
| Sarthak Chaudhary | Design and UI: crew board, landing page, video |
| Vedant Pawankar | Frontend: hotspot map, side panels, video |

TipOff started at the Civic AI Hackathon in St. Louis (October 2026, Problem Set #3: Illegal Dumping). Arjun Arun (311 data extract) and Aarnav Baddam (deployment) contributed to that first version.

## The problem

St. Louis residents filed 4,397 dumping and debris reports through 311 in the 12 months to October 24, 2026. The City raised the maximum dumping fine to $1,000 in 2022, but it still struggles to catch anyone: crews only hear about a pile after someone calls, and even where cameras are installed, footage often misses the plate or the face. 35% of dumping and debris reports stay open for more than a week (median 3.2 days).

The City asked for a way to "proactively identify hotspots of dumping or likely areas/times that offenders frequent to target preventative action." TipOff is that tool.

## Who it's for

City staff. Residents keep reporting through 311 exactly as they do now, and those reports feed TipOff.

- **Refuse crews (Citizens' Service Bureau):** a daily crew board of the blocks that usually get reports on today's weekday, sorted by when to watch them, so cleanups can run on a schedule instead of waiting for calls.
- **Whoever places the city's cameras:** a ranked list of 1,186 dumping hotspots, so the few cameras go where dumping keeps coming back.
- **Code enforcement:** each block's plan lists the evidence a citation needs.

## How it works

1. **Collect.** Every night, a GitHub Actions job downloads the City's public 311 file. Python scripts keep each report's type, location, time and status, never the caller or free-text fields.
2. **Find hotspots.** The city is split into squares about 155 m on a side, roughly a block. A square becomes a hotspot once it has 5 or more reports of one type since January 2024.
3. **Score.** Each hotspot gets a 0–100 score from its last 12 months: report volume 40%, how many different weeks it was reported in 30%, trend against the year before 15%, and vacant buildings within 150 m 15%. The score is a plain formula in [`data/scripts/build_hotspots.py`](data/scripts/build_hotspots.py). It orders where to look first; it does not identify people.
4. **Show it.** The map colors every hotspot by score. Tapping one opens its history: reports per month, which days and hours they come in, and the latest reports.
5. **Plan.** "Write plan" sends that block's facts to the Groq API, which returns a plan in four parts: what we know, where and when to watch, what to do, and the evidence a citation needs. The request carries only the block's own numbers, and the reply may not add dates, counts, people or vehicles that aren't in them.
6. **Crew board.** Each morning's board lists the blocks that usually get reports that day, grouped by watch window (overnight, morning, afternoon, evening). The watch window is the 6 hours before reports usually start, because report times are when people notice the dumping, not when it happens.

TipOff never recognizes faces or license plates. It works with places and times only.

## Does it work?

We scored every dumping hotspot as if it were a year earlier, using only reports up to October 14, 2025, with the same formula the app uses. Then we checked the next 12 months, which the score never saw:

| Top N blocks | Got dumping or debris reports again |
| --- | --- |
| 10 | 9 |
| 50 | 42 |
| 100 | 83 |

Method and full table: [`data/backtest/2026-10-14-video-RESULTS.md`](data/backtest/2026-10-14-video-RESULTS.md). The nightly job re-runs the test on the newest data in [`data/backtest/RESULTS.md`](data/backtest/RESULTS.md). Run it yourself with `python data/scripts/backtest.py`.

## Install it on a phone

TipOff installs from the browser. There's no app store and no account.

- **iPhone or iPad:** open https://tipoff-stl.vercel.app in Safari, tap Share, then **Add to Home Screen**.
- **Android:** open it in Chrome and accept the install prompt, or use the menu (⋮) and pick **Add to Home screen**.

Installed, it runs full screen and opens on the crew board.

There is also a native iPhone app in [`ios/TipOff`](ios/TipOff): a SwiftUI shell around the live site, built and installed with [xtool](https://github.com/xtool-org/xtool) from Linux. A free Apple ID allows 3 sideloaded apps per phone, and each install expires after 7 days, so the browser install is the one to share.

## Tools and languages

| Part | Built with |
| --- | --- |
| Web app | TypeScript, Next.js 16 (App Router), React 19, Tailwind CSS, shadcn/ui |
| Map | Leaflet with OpenStreetMap tiles |
| Data pipeline | Python, pandas (`data/scripts/`) |
| Nightly refresh | GitHub Actions ([`.github/workflows/refresh-data.yml`](.github/workflows/refresh-data.yml)) |
| iPhone app | Swift, SwiftUI, WebKit, built with xtool |
| Hosting | Vercel |
| Integrated APIs | Groq API (`openai/gpt-oss-120b`) writes the block plans and runs the first street-photo check; Gemini API double-checks photos and is the fallback |

All calls to the Groq and Gemini APIs go through one server-only file, [`app/src/lib/llm.ts`](app/src/lib/llm.ts). Each route is rate limited per client, and provider errors are never shown raw.

## Data sources

| Dataset | Link | How TipOff uses it |
| --- | --- | --- |
| Citizens' Service Bureau (311) requests, City of St. Louis | https://www.stlouis-mo.gov/data/datasets/distribution.cfm?id=2 | 40,697 reports since January 2024 (15,474 dumping and debris, 19,444 potholes, 5,779 graffiti), grouped into 2,950 hotspots |
| Vacant Building List, City of St. Louis | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=108 | Vacant buildings within 150 m of a hotspot, one part of the score |
| Parcels / assessor data, City of St. Louis | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=82 | Location and ward for each vacant parcel |
| LRA inventory, Land Reutilization Authority | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=30 | Marks the vacant buildings the city itself owns |
| Mapillary street-level imagery | https://www.mapillary.com | Street photos at top hotspots (CC BY-SA 4.0, credited in `app/public/photos/index.json`) |

Counts are as of the October 24, 2026 refresh and change nightly. The app only reads the cleaned files in `app/data/clean/`; it never calls city systems live. To plug in the City's own 311 database instead of the public file, replace the download step in `data/scripts/fetch_311.py` with a query that returns the same columns (request ID, problem code, location, time opened, status). Nothing else changes.

## Run it yourself

Needs Node 20+.

```bash
git clone https://github.com/summithack-stl/summithack
cd summithack/app
npm ci
cp .env.example .env.local   # add a free Groq API key for "Write plan"
npm run dev                  # http://localhost:3000
```

The map, scores and crew board work with no keys. Only "Write plan" and the street-photo check need an API key.

| Variable | Purpose |
| --- | --- |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | API that writes plans (Groq by default; any OpenAI-compatible API works) |
| `VISION_BASE_URL`, `VISION_API_KEY`, `VISION_MODEL` | API for the street-photo check |
| `CONFIRM_BASE_URL`, `CONFIRM_API_KEY`, `CONFIRM_MODEL` | Fallback API (Gemini) |
| `DEMO_CACHE` | `1` replays saved API replies for demos; `0` by default |

From `app/`: `npm run lint`, `npm run typecheck`, `npm run build`, and `node --test src/lib/*.test.mjs` for the unit tests. CI runs lint, typecheck and build on every pull request.

## Project layout

```
app/                    Next.js web app
  src/app/              pages (/, /map, /crew) and API routes (/api/*)
  src/components/       map, panels, crew board, landing page
  src/lib/              scoring helpers, crew logic, API client
  data/clean/           cleaned city data the app reads
data/scripts/           Python: download, clean, build hotspots, backtest
data/backtest/          backtest results
ios/TipOff/             SwiftUI iPhone app
.github/workflows/      CI and the nightly data refresh
```

## API

| Route | Input | Output |
| --- | --- | --- |
| `POST /api/plan` | JSON `{ id: "dumping-27654_-50128" }` | `{ id, headline, what_we_know[], watch[], actions[], evidence[] }` |
| `POST /api/frames` | multipart `image` (JPEG/PNG/WebP, max 4 MB), optional `lat`, `lon` | `{ detections: [{ category, box, confidence, severity, note }], ms }` |
| `GET /api/health` | none | whether the plan and photo APIs are reachable |

Errors: `400` bad input, `413` image too large, `429` too many requests (see `Retry-After`), `502` the outside API failed, `503` the outside API is busy.

## License

MIT. See [LICENSE](LICENSE).
