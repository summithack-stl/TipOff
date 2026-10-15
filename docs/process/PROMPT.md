# SummitHack pre-prep: orchestrator prompt

Paste this whole file into Sleipnir (or Claude Code) as the project prompt. Working directory: `~/Projects/summithack`.

## Hard budget rule (read first, obey always)

- **Never go above 85% of the current session/usage window.** Before starting each task, check the remaining budget. If finishing that task could push total usage past 85%, **stop**. Write what's done and what's left to `PROGRESS.md`, then exit cleanly.
- For Sleipnir, set `reserve_fraction = 0.15` in `sleipnir.toml` (this keeps 15% unspent, so the cap is 85%) before you launch.
- Route bulk or boilerplate work to the cheapest tier that can do it. Save the expensive model for T2 (architecture and LLM client) and the final review only.
- Don't re-read large files you've already processed. Don't paste whole datasets into context; sample at most 20 rows.

## Context

- 5-person team, first hackathon: InnovateUSA / Missouri Innovation Week **33.5-Hour AI Hackathon**, St. Louis. It starts **Tue Oct 13, 4:00pm CDT**. Progress submission is due **Wed 8pm**, and the final deadline is **Thu Oct 15, 5:30pm CDT**.
- Challenges are announced at kickoff by City of St. Louis leaders, so **the product idea is unknown.** Teams may also pick their own community problem.
- Rules are unpublished. **Do NOT build any product features.** Prepare only boilerplate, tooling, docs and research. Pre-built product code risks disqualification.
- Stack (decided): Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, deployed on Vercel. The LLM is Groq's free tier (`openai/gpt-oss-120b`) through the `openai` npm SDK with a configurable `baseURL`. The fallback is a free Gemini Flash key through Google's OpenAI-compatible endpoint. LLM calls are server-side only.
- Team roles: Tech Lead/AI (Prahlad), Data Engineer (basic Python only, no TypeScript, no AI tools: owns offline Python scripts that turn raw city data into clean JSON the app reads), DevOps/Integrator (git/setup, uses Codex), Frontend (Claude), PM/Pitch (no code).

## Deliverables

Do the tasks in `TASKS.md` in order. Tick each checkbox when its acceptance check passes, and log a one-line result per task in `PROGRESS.md`.

## Definition of done

`npm run build` and `npm run typecheck` pass, `/api/health` returns an LLM reply locally once `.env.local` is filled in, and every doc listed in TASKS.md exists. Nothing in the repo implements a product feature.
