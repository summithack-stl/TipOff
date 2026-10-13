# SummitHack pre-prep tasks

Rules: stay under **85%** session usage (see PROMPT.md). No product features. Tick a box only when its check passes.

## A. Agent tasks (Sleipnir / Claude Code)

- [x] **T1: Scaffold the app** (cheap tier). In `./app`: run `create-next-app` with TypeScript, Tailwind, ESLint, App Router and the `src/` dir. Init shadcn/ui and add button, card, input, textarea, dialog, tabs, sonner (toast) and skeleton. Add a `typecheck` script (`tsc --noEmit`).
  - *Check:* `npm run build` and `npm run typecheck` pass.
- [x] **T2: LLM client abstraction** (strong tier). Create `src/lib/llm.ts`, a single `chat()` / `chatJSON()` wrapper over the `openai` SDK that reads `LLM_BASE_URL`, `LLM_API_KEY` and `LLM_MODEL`. Add a timeout, one retry on 429 with backoff, a clear error message on rate limit, and optional JSON-mode parsing with zod validation. Server-only: import `server-only`.
  - *Check:* typecheck passes, and no client component imports it.
- [x] **T3: Demo response cache** (cheap). In `src/lib/cache.ts`, add an optional file/in-memory cache keyed by a prompt hash, toggled by `DEMO_CACHE=1`, so demo inputs return instantly and survive rate limits.
  - *Check:* a unit test or script shows the second call is a cache hit.
- [x] **T4: Health route** (cheap). `src/app/api/health/route.ts` calls `chat("Say hi in 5 words")` and returns `{ ok, provider, model, reply, ms }`. It returns `ok:false` with the error (not a crash) when no key is set.
  - *Check:* `curl localhost:3000/api/health` returns JSON either way.
- [x] **T5: Env + secrets hygiene** (cheap). Add `.env.example` with `LLM_BASE_URL=https://api.groq.com/openai/v1`, `LLM_API_KEY=`, `LLM_MODEL=openai/gpt-oss-120b`, a commented Gemini fallback (`https://generativelanguage.googleapis.com/v1beta/openai/`) and `DEMO_CACHE=0`. Make sure `.env*.local` is gitignored.
  - *Check:* `git check-ignore .env.local` succeeds.
- [x] **T6: CLAUDE.md + AGENTS.md** (strong tier, short). Write repo rules for every AI tool: the stack, the folder layout (`src/app`, `src/components`, `src/lib`, `src/app/api/*`), "LLM calls only via `src/lib/llm.ts` in server code", TS strict, small PRs (under 300 lines), conventional commits, no secrets, and "run typecheck before commit". Keep `AGENTS.md` (for Codex) identical in substance.
  - *Check:* both files are under 80 lines.
- [x] **T7: CI** (cheap). Add `.github/workflows/ci.yml` running `npm ci`, `npm run lint`, `npm run typecheck` and `npm run build` on PRs and on pushes to main. Add `.github/pull_request_template.md` with What / Why / How tested / Screenshots.
  - *Check:* the YAML is valid (actionlint if available).
- [x] **T8: App shell** (cheap). A neutral layout with a header slot, main content area, toast provider, and loading and error boundaries. **No product content.** Use a placeholder title of "SummitHack".
  - *Check:* `npm run build` passes.
- [x] **T9: St. Louis open-data brief** (cheap tier + web). Write `research/stl-data.md` listing 10–15 usable City of St. Louis / Missouri / federal datasets and APIs for civic problems (311/CSB service requests, vacant/LRA properties, crime/police data, building permits, transit/Metro GTFS, parks, health, housing/eviction, census/ACS). For each: URL, format (CSV/API/GeoJSON), update frequency, auth needed, and 1 idea it enables. Verify every URL actually resolves; mark any you couldn't confirm. Start from https://www.stlouis-mo.gov/data/.
  - *Check:* every row has a working URL or is marked unverified.
- [x] **T9b: Python data pipeline.** `data/scripts/fetch_lra_inventory.py` (pandas) downloads the LRA inventory, cleans it and writes `app/data/clean/lra_inventory.json` and `lra_summary.json`. `data/README.md` is a beginner setup and how-to-run guide. The Data Engineer works only in Python.
  - *Check:* the script runs end to end and its built-in checks pass.
- [x] **T10: Idea scoring rubric** (cheap). Write `docs/idea-rubric.md`, a 1–5 scoring sheet covering: real city pain (named by leaders), uses real STL data, AI is essential not decorative, a demo-able core in about 12 build hours, a clear user, and a measurable impact claim. Include a "kill if" list.
- [x] **T11: Docs templates** (cheap). `README.md` template (Problem, Who it helps, Demo link, How AI is used, Data sources, Architecture diagram placeholder, Run locally, Team & roles). `docs/demo-script.md` (a 2–3 min video beat sheet). `docs/submission-checklist.md` (live URL works in incognito, public repo, README, video, challenge stated, no secrets, submit by 4:30pm Thu).
- [x] **T12: Final review + PROGRESS.md** (strong tier, brief). Confirm the Definition of Done in PROMPT.md, confirm nothing implements product features, and list anything left undone.

## B. Human tasks (agents can't do these)

- [ ] **DevOps:** create the GitHub repo, add all 5 people, push the whole repo (not just `./app`), protect `main` (PRs only).
- [ ] **DevOps:** import the repo into Vercel, set `LLM_BASE_URL`, `LLM_API_KEY` (the demo-only Groq key), `LLM_MODEL`, then deploy and hit `/api/health` on the live URL.
- [ ] **Everyone:** make your own Groq key at console.groq.com for local dev. (Prahlad: local + demo keys done via Sleipnir seat.)
- [x] **Prahlad:** get a free Gemini key from Google AI Studio as the fallback. (Done via Sleipnir seat; in `~/.config/summithack/keys.env`.)
- [ ] **Everyone:** clone, `npm install`, copy `.env.example` to `.env.local`, `npm run dev`, and confirm `/api/health` works.
- [ ] **Data Engineer:** install Python 3.11+, follow `data/README.md` and run `python data/scripts/fetch_lra_inventory.py` once so the environment works before kickoff.
- [ ] **PM/Pitch:** watch prahladv2009@gmail.com for the kickoff join link and organizer replies, and own the shared notes doc.
- [ ] **Everyone:** read `research/stl-data.md` and bring 1 real STL pain point to kickoff.
