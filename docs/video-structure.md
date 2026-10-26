# 2-minute video: structure (not the script)

Problem Set #3, Illegal Dumping. Everyone records their own part remotely and sends raw clips to Sarthak (editor). Prahlad and Claude build the animated parts in Remotion. Sarthak combines everything.

## Run of show (2:00)

| # | Time | Len | Who | On screen | Beats to hit (write your own words) |
|---|---|---|---|---|---|
| 1 | 0:00-0:08 | 8s | Remotion | Title card, then a dumping photo with AI boxes drawing on | App name. One line: "Where does St. Louis's illegal dumping keep coming back?" |
| 2 | 0:08-0:33 | 25s | **Sarthak** | Face cam, then Remotion text cards | The problem. Fine doubled to $1,000 (2022). City cameras miss plates and faces. The city's ask: find where and when to look. **Personal why (~8s).** |
| 3 | 0:33-0:40 | 7s | **Arjun** | Face cam, then Remotion counter 0 → 40,426 | The data. Three years of city 311 reports (dumping, potholes, graffiti), cleaned and grouped into repeat hotspots. **Personal why (one line).** |
| 4 | 0:40-1:10 | 30s | **Prahlad** | Screen recording | The demo. Map, filter to Dumping, click #1 hotspot (8440 N Broadway): 26 reports vs 10 last year, 13 vacant buildings nearby, report timeline, street photo, press Write plan. Read one line of the plan. **Personal why (~5s).** |
| 5 | 1:10-1:18 | 8s | **Vedant** | Face cam, then screen recording of the crew view on a phone-size screen | The crew view. "Today's hotspots" list a crew opens each morning. **Personal why (one line).** |
| 6 | 1:18-1:43 | 25s | **Aarnav** | Face cam, then Remotion architecture diagram | How it works (tech beats below). Privacy line: no faces, no plates, places and times only. **Personal why (~8s).** |
| 7 | 1:43-1:52 | 9s | Prahlad (voice over Remotion card) | Accuracy card + limits | 11 of 13 street problems found on labeled test photos, but only 2 of 4 dumping piles, so the 311 history does the heavy lifting. Report times are when people report, not when dumping happens. |
| 8 | 1:52-2:00 | 8s | **Sarthak** | Face cam, then Remotion end card (names, link) | Who uses it: Citizens' Service Bureau, refuse crews, code enforcement. Live link. |

Screen time: Prahlad ~39s, Sarthak ~33s, Aarnav ~25s, Vedant ~8s, Arjun ~7s.

## Technical facts (all verified against the repo on 2026-10-14; use these exact numbers)

- **Data:** City of St. Louis Citizens' Service Bureau (311) open data, 2024-01 to 2026-10. 40,426 reports: 15,342 dumping and debris, 19,343 potholes, 5,741 graffiti. Python (pandas) scripts clean them and group them into ~155 m cells: 2,925 repeat hotspots (1,173 dumping).
- **Score (0-100):** recent volume (40%), how many different weeks it's reported (30%), trend vs last year (15%), vacant buildings within 150 m (15%). It orders where to look first. It does not predict crime.
- **Hero hotspot:** 8440 N Broadway, Ward 13, score 78, #1 dumping. 26 reports in the last 12 months vs 10 the year before. 13 vacant buildings within 150 m. Reports mostly come in Wednesdays, 5-8am.
- **AI, part 1 (photos):** street-level photos from Mapillary (public, CC BY-SA). A fast vision model on Groq flags dumping, potholes, graffiti, curb and sidewalk damage. Gemini double-checks anything uncertain or severe.
- **AI, part 2 (plans):** gpt-oss-120b on Groq writes a camera and cleanup plan from sourced facts only: where and when to watch, actions, evidence for a citation.
- **Accuracy:** on 53 hand-labeled test photos, 11 of 13 street problems found (dumping 2 of 4, potholes 4 of 4, graffiti 5 of 5).
- **Stack:** Next.js + TypeScript on Vercel. No live calls to city servers; the app reads cleaned data files. Open source on GitHub.
- **Privacy:** no face or license-plate recognition. No caller names or free text saved from 311.
- **Honest limits:** 311 report times are not dumping times. Street photos rarely cover alleys.

## Decisions before recording

- **Name:** the app header says "StreetSense", and the pitch says "Dumping Radar". Pick one.
- **Opening photo:** don't use 4700 Plover Ave. It's a fenced private yard (Sarthak's catch). Use our own phone photo of a public dumping pile (no people or plates in frame), or the credited Wikimedia test photo `app/eval/photos/dumping-1.jpg`.

## Recording rules (everyone, remote)

- Landscape, 1920x1080, 30 fps. Phone sideways or a laptop webcam at eye level, window light in front of you, quiet room.
- Record 2-3 takes of your part, each one a separate file. Leave 1 second of silence before and after.
- Name files `<part#>-<name>-take<N>.mp4`, e.g. `2-sarthak-take1.mp4`.
- Upload to the shared Drive folder for Sarthak by **Thu 10:00am CT**.
- The personal "why" is yours. Write it yourself, not with AI.

## Pipeline and deadlines (Thu Oct 15, CT)

- 10:00am: all face-cam clips to Sarthak. Prahlad sends the screen recordings.
- 11:00am: Prahlad sends the Remotion clips (title, counter, architecture, accuracy card, end card) as 1920x1080 30 fps MP4s.
- 2:00pm: Sarthak's final cut, under 2:00.
- 3:30pm: YouTube (unlisted), link pasted in the organizer doc, project zip in the Dropbox.
- 4:30pm: our hard stop (the organizers' cutoff is 5:30pm).
