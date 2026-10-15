# TipOff

> Finds the St. Louis blocks where illegal dumping keeps coming back, shows when it gets reported, and writes a camera and cleanup plan for city staff.

**Try it:** https://summithack-blond.vercel.app (no login). Pick **Dumping**, click a hotspot, press **Write plan**. The morning crew list is at [`/crew`](https://summithack-blond.vercel.app/crew).

**Run it yourself** (Node 20+): `git clone https://github.com/summithack-stl/summithack && cd summithack/app && npm ci && npm run dev`, then open http://localhost:3000. The map, scores and crew list work with no keys; the AI plan and photo check need a free Groq key in `app/.env.local` (see [Run locally](#run-locally)).

## Problem

Civic AI Hackathon, Problem Set #3: Illegal Dumping. The City raised the maximum dumping fine from $500 to $1,000 in 2022, but it still struggles to gather evidence: even where cameras are installed, footage often misses the plate or the face. The City asked for help to "proactively identify hotspots of dumping or likely areas/times that offenders frequent to target preventative action."

## Who it helps

City staff, not residents. Residents keep reporting through 311 exactly as they do now; those reports feed TipOff.

- **Citizens' Service Bureau / refuse crews:** a daily list of the blocks that usually get reports on today's weekday, with a suggested watch window and a plan. Crews can clean on a schedule instead of waiting for complaints (35% of dumping and debris reports stay open more than a week; median 3.2 days).
- **Whoever places the city's cameras:** a ranked list of 1,173 dumping hotspots, so the few cameras go to the blocks where dumping keeps coming back, recording around the clock.
- **Code enforcement:** each plan lists the evidence a citation needs.

### How the City gets the most out of it

1. **Cameras:** put them on the top-ranked blocks first, recording 24/7 (report times are when people report, not when dumping happens).
2. **Cleanups:** schedule crews from the daily Crew list instead of only reacting to new 311 tickets.
3. **Evidence:** use each block's plan as the checklist for a citation.
4. **Measure:** re-check a block's reports a month after acting on it. If they don't drop, change the approach. The nightly data refresh makes this a habit, not a project.

## Demo

- Live app: https://summithack-blond.vercel.app (overview and setup guide; hotspot map at `/map`, crew list at `/crew`)
- Demo video: https://youtu.be/z5E3rEblO9o

## Does it work? (backtest)

We scored every dumping hotspot as if it were a year ago, using only reports up to 2025-10-14, with the same formula the app uses. Then we checked the next 12 months, which the score never saw:

| Top N blocks | Got dumping or debris reports again |
| --- | --- |
| 10 | 9 |
| 50 | 42 |
| 100 | 83 |

Full table and method, exactly as shown in our video: [`data/backtest/2026-10-14-video-RESULTS.md`](data/backtest/2026-10-14-video-RESULTS.md). The nightly job also re-runs the test on the newest data in [`data/backtest/RESULTS.md`](data/backtest/RESULTS.md), so the proof keeps checking itself; those numbers can shift slightly as the one-year window moves. Re-run it yourself with `python data/scripts/backtest.py`.

## How a block becomes a hotspot

`data/scripts/build_hotspots.py` splits the city into squares about 155 m on a side (roughly a block). A square is a hotspot once it has 5 or more reports of one type since January 2024. Each hotspot gets a 0-100 score from its last 12 months: report volume (ranked against hotspots of the same type) 40%, how many different weeks it was reported in 30%, trend against the 12 months before 15%, vacant buildings within 150 m 15%. The score orders where to look first; it does not predict crime and never identifies people.

## How AI is used

- **Plans** (`POST /api/plan`, gpt-oss-120b on Groq): turns a hotspot's sourced facts into a plan (what we know, where and when to watch, actions, evidence for a citation). The prompt allows only the given facts: no invented dates, counts, people, vehicles or causes.
- **Street photos** (`POST /api/frames`): a fast vision model on Groq flags dumping, potholes, graffiti and curb or sidewalk damage; Gemini double-checks anything uncertain or severe. On 53 hand-labeled test photos it found 11 of 13 street problems (2 of 4 dumping piles), so the 311 history does the heavy lifting.
- No face or license-plate recognition anywhere.
- **Not AI:** the hotspot score is a plain formula (see [How a block becomes a hotspot](#how-a-block-becomes-a-hotspot)), not a model. The backtest uses that same formula.
- **Demo video:** every voice is a real team member. Edits only cut words out; no voice was AI-generated or cloned.

## Keeping the data fresh

`.github/workflows/refresh-data.yml` runs every night: it downloads the City's latest 311 file, rebuilds the hotspots and the backtest, and commits the result; Vercel redeploys on its own. To connect the City's own 311 database instead of the public CSV, replace the download step in `data/scripts/fetch_311.py` with a query that returns the same columns (request ID, problem code, location, time opened, status). Nothing else changes.

## Data sources

| Dataset | URL | How we use it |
| --- | --- | --- |
| Citizens' Service Bureau (311) requests (City of St. Louis) | https://www.stlouis-mo.gov/data/datasets/distribution.cfm?id=2 | 40,426 reports of dumping and debris (6 problem codes; 2,157 use the "Illegal dumping" code), potholes and graffiti from 2024-2026, grouped into 2,925 repeat hotspots (`data/scripts/fetch_311.py`, `build_hotspots.py`). We keep location, type and time only, never the caller or free-text fields. Report times are when residents reported, not when dumping happened. |
| Vacant Building List (City of St. Louis) | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=108 | The 9,943 buildings on the city's vacant list, with code violations, unpaid vacant-building fees and time on the list. Used as context for hotspots (vacant buildings within 150 m). |
| Parcels / assessor data (City of St. Louis) | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=82 | Location, ward and year built for each vacant parcel (9,884 have a location). |
| LRA inventory (Land Reutilization Authority) | https://www.stlouis-mo.gov/data/datasets/dataset.cfm?id=30 | Flags the 338 vacant buildings the city itself owns. |
| Mapillary street-level imagery | https://www.mapillary.com | Street photos at the top 311 hotspots and the riskiest vacant buildings (CC BY-SA 4.0, credited in `app/public/photos/index.json`). |
| Wikimedia Commons | https://commons.wikimedia.org | Street-issue test photos for the accuracy check (licenses in `app/eval/sources.json`). |

Python scripts in `data/scripts/` download and clean the city data into `app/data/clean/`. The app only reads those files; it never calls city APIs live.

## Architecture

```
city open data ──(data/scripts/*.py)──> app/data/clean/*.json ──┐
                                                                 ├──> Next.js app (Vercel)
Mapillary photos ──(scripts/fetch-building-photos.mjs)──> public/photos/
                                                                 │
  POST /api/frames  photo ──> fast vision pass (Groq) ──> unsure or severe? ──> second opinion (Gemini)
                                     │ rate-limited or down: Gemini does the whole frame
  POST /api/plan    hotspot facts ──> camera and cleanup plan (gpt-oss-120b on Groq, sourced facts only)
  POST /api/brief   building record + photo findings ──> short firefighter brief (Groq text model)
  GET  /api/health  LLM reachable? which vision providers are configured?
```

All model calls go through `app/src/lib/llm.ts` (server only). Each route is rate limited per client and never returns raw provider errors.

### Earlier direction: vacant-building inspection map

Before Problem Set #3 was announced we built a vacant-building inspection map; its code is still in the repo (`/api/brief`, `fetch_vacant_buildings.py`), and TipOff uses the vacant-building list only as one hotspot signal. Every vacant building gets a 0–100 score from city records only. Each part is capped so no single field dominates: major code violations up to 35 points, time on the vacant list up to 20, building age up to 15 (pre-1900 gets all 15), minor code violations up to 10, recent 311 complaints up to 10, unpaid vacant-building fees up to 10. The formula lives in `data/scripts/fetch_vacant_buildings.py`. The score orders buildings for inspection. It does not predict collapse. Each building keeps its plain-language reasons (for example "29 major code violations").

### API

| Route | Input | Output |
| --- | --- | --- |
| `POST /api/frames` | multipart form: `image` (JPEG/PNG/WebP, max 4 MB), `camera_id`, optional `lat`, `lon`, `captured_at`, `confirm` (`1` default, `0` skips the second model), `precise` (`1` sends the whole frame to the second model for tighter boxes) | `{ detections: [{ category, box: {x,y,w,h} (0–1), confidence, severity, note, confirmed }], ms }` |
| `POST /api/plan` | JSON `{ id: "hotspot id, e.g. dumping-27654_-50128", detections?: [{ category, severity, note }] }` | `{ id, headline, what_we_know[], watch[], actions[], evidence[] }` |
| `POST /api/brief` (earlier direction) | JSON `{ handle: "11-digit parcel handle", detections?: [{ category, severity, note }] }` | `{ handle, headline, hazards[], crew_notes[] }` |
| `GET /api/health` | none | `{ ok, provider, model, vision: { fast, confirm }, reply, ms }` |

Categories: building hazards `open_entry`, `roof_damage`, `wall_damage`, `fire_damage`; street issues `graffiti`, `pothole`, `dumping`, `streetlight_out`, `broken_curb`, `sidewalk_damage`.

Errors: `400` bad input, `404` unknown building, `413` image too large, `429` too many requests from one client (see `Retry-After`), `502` AI call failed, `503` AI provider busy.

### Free-tier limits

Groq's free vision tier allows about 200,000 tokens a day, which is roughly 95 photos (about 2,100 tokens each), shared by every key in the same Groq organization. When it runs out, `/api/frames` falls back to Gemini for the whole frame. For demos, use the saved detections in `public/photos/index.json` or set `DEMO_CACHE=1`.

## Run locally

```bash
cd app
npm i
cp .env.example .env.local
# Set LLM_API_KEY in .env.local, then:
npm run dev
```

Open [http://localhost:3000/api/health](http://localhost:3000/api/health) to check the LLM connection and see whether the vision keys are set. Without an API key, the endpoint reports `ok: false` in its JSON response.

### Environment

Copy `app/.env.example` to `app/.env.local` and set:

| Variable | Purpose |
| --- | --- |
| `LLM_BASE_URL` | OpenAI-compatible API base URL; the example uses Groq, with Gemini settings commented out. |
| `LLM_API_KEY` | API key for the chosen provider. Keep it in `.env.local`. |
| `LLM_MODEL` | Model name available from the chosen provider. |
| `DEMO_CACHE` | `0` by default. Set to `1` to reuse cached LLM replies for matching prompts during demos. |
| `VISION_BASE_URL`, `VISION_API_KEY`, `VISION_MODEL` | Fast photo pass (Groq vision). |
| `CONFIRM_BASE_URL`, `CONFIRM_API_KEY`, `CONFIRM_MODEL` | Second opinion and fallback (Gemini). |

`DEMO_CACHE=1` is useful for repeatable demos and fewer live API calls. Turn it off when you need fresh replies.

### Scripts

Run these from `app/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run lint checks. |
| `npm run typecheck` | Run TypeScript with `--noEmit`. |

## Team & roles

| Name | Role |
| --- | --- |
| Prahlad Venugopalan | Tech lead / AI |
| Arjun Arun | Data (311 extract, hotspots) |
| Aarnav Baddam | DevOps |
| Vedant Pawankar | Frontend (map, overlay) |
| Sarthak Chaudhary | Presenter, crew view, video |
