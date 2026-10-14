# [Project name]

> One sentence: what it does and for whom.

## Problem

[The St. Louis problem, in the words city leaders used at kickoff. Name the challenge we picked.]

## Who it helps

[The specific user, e.g. "a CSB intake worker", and what changes for them.]

## Demo

- Live app: [URL]
- Demo video: [URL]

## How AI is used

[What the model does that a form or dashboard couldn't, which model and provider, and how we check its output against source data.]

## Data sources

| Dataset | URL | How we use it |
| --- | --- | --- |
| Citizens' Service Bureau (311) requests (City of St. Louis) | https://www.stlouis-mo.gov/data/datasets/distribution.cfm?id=2 | 40,426 reports of illegal dumping and debris, potholes and graffiti from 2024-2026, grouped into 2,925 repeat hotspots (`data/scripts/fetch_311.py`, `build_hotspots.py`). We keep location, type and time only, never the caller or free-text fields. Report times are when residents reported, not when dumping happened. |
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
  POST /api/brief   building record + photo findings ──> short firefighter brief (Groq text model)
  GET  /api/health  LLM reachable? which vision providers are configured?
```

All model calls go through `app/src/lib/llm.ts` (server only). Each route is rate limited per client and never returns raw provider errors.

### Inspection priority score

Every vacant building gets a 0–100 score from city records only. Each part is capped so no single field dominates: major code violations up to 35 points, time on the vacant list up to 20, building age up to 15 (pre-1900 gets all 15), minor code violations up to 10, recent 311 complaints up to 10, unpaid vacant-building fees up to 10. The formula lives in `data/scripts/fetch_vacant_buildings.py`. The score orders buildings for inspection. It does not predict collapse. Each building keeps its plain-language reasons (for example "29 major code violations").

### API

| Route | Input | Output |
| --- | --- | --- |
| `POST /api/frames` | multipart form: `image` (JPEG/PNG/WebP, max 4 MB), `camera_id`, optional `lat`, `lon`, `captured_at`, `confirm` (`1` default, `0` skips the second model), `precise` (`1` sends the whole frame to the second model for tighter boxes) | `{ detections: [{ category, box: {x,y,w,h} (0–1), confidence, severity, note, confirmed }], ms }` |
| `POST /api/brief` | JSON `{ handle: "11-digit parcel handle", detections?: [{ category, severity, note }] }` | `{ handle, headline, hazards[], crew_notes[] }` |
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
| Prahlad | Tech lead / AI |
| [name] | Core backend / data |
| [name] | DevOps / integrator |
| [name] | Frontend |
| [name] | PM / pitch |
