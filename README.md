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
| [name] | [url] | [use] |

## Architecture

[Diagram placeholder: browser → Next.js page → `/api/*` route → `src/lib/llm.ts` → Groq (Gemini fallback), plus data files.]

## Run locally

```bash
cd app
npm i
cp .env.example .env.local
# Set LLM_API_KEY in .env.local, then:
npm run dev
```

Open [http://localhost:3000/api/health](http://localhost:3000/api/health) to check the LLM connection. Without an API key, the endpoint reports `ok: false` in its JSON response.

### Environment

Copy `app/.env.example` to `app/.env.local` and set:

| Variable | Purpose |
| --- | --- |
| `LLM_BASE_URL` | OpenAI-compatible API base URL; the example uses Groq, with Gemini settings commented out. |
| `LLM_API_KEY` | API key for the chosen provider. Keep it in `.env.local`. |
| `LLM_MODEL` | Model name available from the chosen provider. |
| `DEMO_CACHE` | `0` by default. Set to `1` to reuse cached LLM replies for matching prompts during demos. |

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
