# Progress log

Run: Sleipnir `project orchestrate` on 2026-10-12, 15-task plan (14 tasks + planner), `reserve_fraction = 0.15`. Hand fixes and checks done afterwards in Claude Code.

- T1 scaffold: done (Sleipnir). `npm ci`, lint, typecheck, build pass locally with the default Turbopack build.
- T2 llm.ts: done (Sleipnir), plus a hand fix: a clear error message when the retry also gets 429. Imports `server-only`; no client component imports it.
- T3 cache: done (Sleipnir). `node --test src/lib/cache.test.mjs`: 2 pass, second call is a cache hit.
- T4 health: done (Sleipnir). With no key: HTTP 200 `{"ok":false,...,"error":"LLM_API_KEY is not set"}`. Not yet run with a real key.
- T5 env: done (Sleipnir), model fixed by hand from `gpt-oss-20b` to `openai/gpt-oss-120b`. `.env.local` is ignored by `app/.gitignore`.
- T6 CLAUDE.md + AGENTS.md: rewritten by hand (Sleipnir's version left out stack, layout, PR size, commit style, typecheck-before-commit). 13 and 15 lines.
- T7 CI: done (Sleipnir); hand fix limits push trigger to `main`. YAML parses; actionlint is not installed.
- T8 app shell: done (Sleipnir). Neutral "SummitHack starter" card linking to `/api/health`. Verify task removed Google Fonts for offline builds.
- T9 stl-data: Sleipnir workers failed twice (not allowed to run shell commands, so couldn't fetch URLs). Done by hand: 15 sources checked in Sleipnir's seat browser; SLMPD page 404 and CDC download link marked unverified.
- T10 rubric: Sleipnir's version missed four criteria and the kill list; rewritten by hand.
- T11 docs: demo script from Sleipnir. README and checklist patched by hand to add the missing template sections, 4:30pm deadline, incognito check and challenge statement.
- T12 review: done by hand. Definition of Done fully met: `/api/health` returned ok:true, reply "pong" from openai/gpt-oss-120b in 447 ms (Groq key made via Sleipnir seat, expires 2026-10-19). No product features in the repo.

## Left for humans
- Fill `app/.env.local` with a Groq key and confirm `/api/health` returns `ok:true`.
- Part B of TASKS.md (repo, Vercel, keys).
- Root docs (`CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/`, `research/`, `.github/`) sit beside `app/`. Push the whole folder, not just `./app`, or CI and the docs won't come along. Leave out `artifacts/`, `plan.json`, `results.jsonl`, `proposals/`, `run.lock`, `orchestrate.log` and `sleipnir.toml`.

## 2026-10-12 evening
- Keys, all made through the Sleipnir seat browser (Google sign-in typed via `sleipnir secret ask`, never seen by the agent):
  - Groq `summithack-local` (expires 2026-10-19) in `app/.env.local`; `/api/health` returned ok:true.
  - Groq `summithack-demo` (expires 2026-10-19) in `~/.config/summithack/keys.env`, for Vercel.
  - Gemini `summithack-gemini` in the same file and as a commented fallback in `app/.env.local`. `gemini-3.8-flash` answered, but took 28.8 s; `llm.ts` times out at 20 s.
  - A first Gemini key (`summithack-fallback`) was printed into the chat log by mistake (new `AQ.` key format slipped past redaction). Deleted in AI Studio and replaced.
  - AI Studio flags an older, unrelated key ending `uMFk` as publicly exposed. Prahlad to revoke.
- T9b: Backend role is now a Python-only Data Engineer. `data/scripts/fetch_lra_inventory.py` ran on live data: 10,349 rows in, 10,346 parcels out, checks pass. Beginner guide in `data/README.md`. Roles doc, CLAUDE.md, AGENTS.md and TASKS.md updated to match.
