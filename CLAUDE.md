# Repository rules

- Stack: Next.js App Router, TypeScript (strict), Tailwind, shadcn/ui, deployed on Vercel. LLM: Groq (`openai/gpt-oss-120b`) via the `openai` SDK with a configurable base URL; Gemini Flash is the fallback.
- Layout: the app lives in `app/`. Pages and layouts in `app/src/app`, API routes in `app/src/app/api/*`, UI in `app/src/components` (shadcn primitives in `components/ui`), shared code in `app/src/lib`.
- Data: the nightly 311 refresh runs in the app as a Vercel Cron (`/api/cron/refresh` → `app/src/lib/refresh/`, a TypeScript port of `data/scripts/*.py`) and publishes to Blob storage, outside git. Only the refresh fetches city data; request handlers never call city APIs. The Python scripts in `data/scripts/` still write `app/data/clean/`, which is the bundled fallback and what the GitHub refresh commits until the cron replaces it. Keep the two in step: `node scripts/refresh-parity.mjs` checks the port against the Python output. Never add a Python server.
- LLM calls go only through `app/src/lib/llm.ts`, from server code. It imports `server-only`; never import it into a client component.
- Commands (run in `app/`): `npm run dev`, `npm run lint`, `npm run typecheck`, `npm run build`. Cache test: `node --test src/lib/cache.test.mjs`.
- Env: copy `app/.env.example` to `app/.env.local` and set `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. `DEMO_CACHE=1` replays cached LLM replies for demos.
- Never commit `.env*.local`, API keys or other secrets.
- Keep TypeScript strict. Don't silence errors with `any` or `@ts-ignore`.
- Run `npm run typecheck` before every commit.
- Small PRs, under 300 changed lines, one concern each. CI (lint, typecheck, build) must pass before merge.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Reuse existing shadcn components before writing custom UI.
