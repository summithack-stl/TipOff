# Repository rules

Same rules as `CLAUDE.md`, for Codex and other agents that read `AGENTS.md`.

- Stack: Next.js App Router, TypeScript (strict), Tailwind, shadcn/ui, deployed on Vercel. LLM: Groq (`openai/gpt-oss-120b`) via the `openai` SDK with a configurable base URL; Gemini Flash is the fallback.
- Layout: the app lives in `app/`. Pages and layouts in `app/src/app`, API routes in `app/src/app/api/*`, UI in `app/src/components` (shadcn primitives in `components/ui`), shared code in `app/src/lib`.
- Data: Python scripts in `data/scripts/` (pandas) download and clean city data and write JSON to `app/data/clean/`. App code only reads those files. Never call city APIs live from the app, and never add a Python server.
- LLM calls go only through `app/src/lib/llm.ts`, from server code. It imports `server-only`; never import it into a client component.
- Commands (run in `app/`): `npm run dev`, `npm run lint`, `npm run typecheck`, `npm run build`. Cache test: `node --test src/lib/cache.test.mjs`.
- Env: copy `app/.env.example` to `app/.env.local` and set `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. `DEMO_CACHE=1` replays cached LLM replies for demos.
- Never commit `.env*.local`, API keys or other secrets.
- Keep TypeScript strict. Don't silence errors with `any` or `@ts-ignore`.
- Run `npm run typecheck` before every commit.
- Small PRs, under 300 changed lines, one concern each. CI (lint, typecheck, build) must pass before merge.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Reuse existing shadcn components before writing custom UI.

- CAC entry: TipOff; video lives in `~/Projects/tipoff-video`. Preserve the three-person CAC team and original hackathon credits separately.
- Ballwin/Chesterfield support is map + photo reporting; municipal 311 history is unavailable there.
- Report photos/records currently use public Blob URLs. Never describe them as private or claim reporter hashes verify people/residency.
