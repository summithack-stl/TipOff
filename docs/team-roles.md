# SummitHack team roles

Event: InnovateUSA / Missouri Innovation Week 33.5-Hour AI Hackathon, St. Louis.

| When | What |
|---|---|
| **Tue Oct 13, 4:00pm CDT** | Kickoff. City leaders announce the challenges. |
| Tue evening | Pick one idea with `docs/idea-rubric.md`. Start building. |
| **Wed Oct 14, 8:00pm CDT** | Progress submission due. |
| **Thu Oct 15, 4:30pm CDT** | Our own submit-by time. |
| **Thu Oct 15, 5:30pm CDT** | Hard deadline. |

Data: Python scripts in `data/scripts/` write JSON to `app/data/clean/`; the app only reads it.

Stack: Next.js + TypeScript + Tailwind + shadcn/ui on Vercel. The AI runs through Groq, with Gemini as backup, and only from server code (`app/src/lib/llm.ts`). Repo rules are in `CLAUDE.md`. Everything below is split so you can paste one section into an email.

---

## Prahlad — Tech Lead / AI

Hi Prahlad,

You own the technical direction and everything the AI does.

**Before kickoff (by Tue 4pm)**
- Make two Groq keys at console.groq.com: one for local dev and one kept only for the live demo. The demo key is already made and saved in `~/.config/summithack/keys.env` on Prahlad's laptop; hand it to [DevOps name] in person or by password manager, never in chat.
- The Gemini fallback key is in the same file. `gemini-3.8-flash` works but was slow (one reply took ~29 s); raise the 20 s timeout in `llm.ts` before switching to it.
- Check that `/api/health` returns `ok:true` on your machine.
- Read `research/stl-data.md`.

**During the hackathon**
- Run the idea pick at kickoff with the rubric. You break ties.
- Write the prompts and the AI logic, all through `chat()` / `chatJSON()` in `app/src/lib/llm.ts`.
- Sketch the architecture in the first hour: what page, what API route, what data. Post it in the team notes.
- Review every PR that touches `src/lib` or `src/app/api`.
- Before the demo, turn on `DEMO_CACHE=1` and run the demo inputs once, so replies come back instantly and survive rate limits.

**You're done when** the deployed app gives a real AI answer from real St. Louis data, and the demo path works three times in a row.

---

## [Name] — Data Engineer (Python)

Hi [Name],

You own the data: getting it from the city, cleaning it, and making sure every number we show is right. You work only in Python. You won't touch TypeScript or the website code, and nobody will ask you to learn it this week.

How it fits together: your Python scripts in `data/scripts/` download St. Louis open data, clean it with pandas, and save JSON files into `app/data/clean/`. The website reads those files. That handoff is the only place your work and the website meet.

**Before kickoff (by Tue 4pm)**
- Install Python 3.11+ and follow `data/README.md` step by step: clone the repo, make a virtual environment, `pip install -r data/requirements.txt`.
- Run `python data/scripts/fetch_lra_inventory.py` once. It downloads about 10,000 city-owned parcels and saves clean JSON. Tell Prahlad when it works or exactly where it breaks.
- Read the script top to bottom. It's about 100 lines, and every new dataset starts as a copy of it.
- Skim `research/stl-data.md` and download one or two other CSVs (311 requests, vacant buildings) to see what messy city data looks like.

**During the hackathon**
- Once we pick the idea, copy the example script for the datasets we need and rewrite `clean()` for their columns.
- Save two files per dataset: the cleaned records, and a small summary (counts, top-10 lists) that the AI can read.
- Commit the script and its JSON output together. The live demo reads our saved JSON, never the city website.
- Agree field names with [Frontend name] early, and don't rename them later without telling them.
- Fact-check: every number in the pitch, README and video traces back to your JSON and a source URL. Keep that list in the team notes.

**You're done when** the app's data comes from your committed JSON files, every dataset is credited with its URL and download date, and every stat in the pitch has been checked.

---

## [Name] — DevOps / Integrator

Hi [Name],

You own the repo, the deploy, and making sure everyone's code lands cleanly.

**Before kickoff (by Tue 4pm)**
- Create the GitHub repo and push the whole `summithack/` folder, not just `app/`. CI and the docs live outside `app/`.
- Add all five of us as collaborators.
- Protect `main`: changes only through pull requests, with CI required to pass.
- Import the repo into Vercel and set the root directory to `app`. Add these env vars: `LLM_BASE_URL=https://api.groq.com/openai/v1`, `LLM_API_KEY` (Prahlad's demo key), `LLM_MODEL=openai/gpt-oss-120b`.
- Deploy, then open `<live-url>/api/health` and check it says `"ok":true`.
- Help anyone whose local setup breaks.

**During the hackathon**
- Merge PRs fast. Keep them under 300 lines and squash-merge.
- Watch CI. If `main` goes red, fixing it is the top job.
- Redeploy after each merge and check the live URL.
- Your Codex setup reads `AGENTS.md` for the repo rules.

**You're done when** the live URL works in an incognito window, `main` is green, and the repo is public by submission time.

---

## [Name] — Frontend

Hi [Name],

You own what the judges see and click.

**Before kickoff (by Tue 4pm)**
- Same setup as everyone: clone, `npm install` in `app/`, `.env.local` with your own Groq key, `npm run dev`, check `/api/health`.
- Look at `app/src/components/ui/`. Button, card, input, textarea, dialog, tabs, toast and skeleton are already installed. Use them before writing new components.
- Your Claude setup reads `CLAUDE.md` for the repo rules.

**During the hackathon**
- Build the screens for the one demo path. One clear flow beats five half-done pages.
- Show loading states with skeletons, and show errors with toasts. The AI can be slow or rate-limited, so the screen must never sit blank.
- Make it work on a phone-sized screen too. Judges may open the link on a phone.
- Take screenshots for the README and the submission once it looks right.

**You're done when** a stranger can open the live URL and finish the demo flow without being told what to click.

---

## [Name] — PM / Pitch

Hi [Name],

You own the story, the deadlines, and the submission. No code needed.

**Before kickoff (by Tue 4pm)**
- Watch prahladv2009@gmail.com for the kickoff join link and any organizer emails. Forward anything important to the group right away.
- Set up a shared notes doc for the team. Put the deadlines above at the top.
- Read `research/stl-data.md` and `docs/idea-rubric.md`.

**During the hackathon**
- At kickoff, write down the exact words city leaders use about each challenge. We'll quote them in the pitch.
- Run the scoring with `docs/idea-rubric.md` and keep the scores in the notes doc.
- Keep time. Remind the team about the Wed 8pm progress submission and the Thu 4:30pm submit-by.
- Write the demo script from `docs/demo-script.md` (2–3 minutes), and record the video once the app works.
- Fill in the README story sections: Problem, Who it helps, How AI is used, Impact.
- Go through `docs/submission-checklist.md` line by line before submitting.

**You're done when** the submission is in by 4:30pm Thursday with a working live link, the video, and a README that a judge could read in two minutes.

---

## Everyone

- Make your own Groq key at console.groq.com for local work. Never commit it; it goes in `app/.env.local` only.
- Bring one real St. Louis problem to kickoff, ideally one that a dataset in `research/stl-data.md` can back up.
- Run `npm run typecheck` before every commit. Use small PRs with conventional commit messages (`feat:`, `fix:`, `docs:`).
- If you're stuck for more than 20 minutes, say so in the group chat.
