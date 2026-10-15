# Two-minute video script: Dumping Radar

Challenge: City of St. Louis Problem Set #3, Illegal Dumping. The city asked for two things: find hotspots ahead of time, including the likely places and times offenders go, and help track offenders down.

The judges see only this video plus our story. Every number on screen must come from city open data or our own measured test. Two lines we never cross: we don't claim to predict when dumping happens (311 times are when people **report** it), and we don't identify people.

| Time | On screen | Voiceover (draft) | What it proves |
| --- | --- | --- | --- |
| 0:00–0:10 | Cold open: a dumping photo, full screen. See "Opening photo" below for which one. | "This is illegal dumping: furniture, tires, debris, left on a street or an empty lot." | It matters. |
| 0:10–0:25 | Text on screen: "Max fine: $500 → $1,000 (2022)". Then: "Cameras often miss plates and faces." | "In 2022 St. Louis doubled the maximum fine to $1,000. But the city still struggles to catch people: cameras often miss the plate and the face. The city asked us to find where and when to look." | The city's own problem, in its words. |
| 0:25–0:45 | Hotspots map (`/`), all 311 types, then filter to Dumping. Zoom toward the north side. | "We took 40,426 St. Louis 311 reports from 2024 to today: 15,342 about dumping and debris, plus potholes and graffiti. They group into 1,173 repeat dumping hotspots, each scored by how often, how recently and how steadily it gets reported." | Real city data, at city scale. |
| 0:45–1:25 | One hotspot: **#1, 8440 N Broadway** (Ward 13). Open the panel: score 78, 26 reports in the last 12 months, up from 10 the year before, most reports on Wednesday, mostly reported 5–8am, 13 vacant buildings within 150 m. Show the monthly 311 timeline and the latest reports. Show the street photo. Click **Write plan**: the camera and cleanup plan appears (headline, where and when to watch, actions, evidence). | "Take the number one hotspot, 8440 North Broadway. Twenty-six reports this year, up from ten. Most come in on Wednesday mornings, so the drop likely happens the night before. AI checks the latest street photo of the spot, then writes a plan: where to point a camera, when to send drive-bys and a cleanup crew, and an evidence packet with the 311 history and photos to support a citation." | It works on a real address, end to end. |
| 1:25–1:40 | Crew view (`/crew`): "Today's hotspots" list. Scroll two cards, click **Open plan** on one. | "Every morning, cleanup crews and enforcement get today's list: the address, the hours to watch, what's there, and the plan one tap away." | A real user and a daily habit. |
| 1:40–1:50 | Text on screen: "We do NOT identify people. No face or license-plate recognition." | "One thing we don't do: identify people. No face recognition, no license plates. Dumping Radar points cameras and crews at places and times. Identifying an offender stays with the city's investigators and the law." | Judges will ask. Answer it before they do. |
| 1:50–2:00 | Accuracy result and data sources. Then who uses it, and the link. | "On labeled test photos, AI found 11 of 13 dumping, pothole and graffiti problems, though only 2 of 4 dumping piles, so the 311 history does the heavy lifting. Built for the Citizens' Service Bureau, refuse crews and code enforcement. Open source. [URL]" | Honest, not a mockup, adoptable. |

## Numbers on screen, and where they come from

- $500 → $1,000 maximum fine (2022), cameras missing plates and faces: the organizers' Problem Set #3 text.
- 40,426 reports (19,343 pothole, 15,342 dumping and debris, 5,741 graffiti), 2024-01-01 to 2026-10-14; 1,173 dumping hotspots: `app/data/clean/street_reports.json`, `hotspots.json`, `hotspots_summary.json`, built by `data/scripts/fetch_311.py` and `build_hotspots.py` from the city's CSB data. If the data is rebuilt before recording, re-check every number.
- 8440 N Broadway figures: `hotspots.json`, id `dumping-27654_-50128`.
- 11 of 13: `app/eval/results-precise.json` (2026-10-14), dumping 2 of 4, pothole 4 of 4, graffiti 5 of 5. Re-run `node scripts/eval-detect.mjs --precise 1` after any label change and update this line.

## Decisions for the team before recording

1. **Opening photo.** Best: our own phone photo of a real St. Louis dumping pile taken from public property, with no people or plates in frame. Fallback: `app/eval/photos/dumping-1.jpg` (furniture on a sidewalk, Wikimedia Commons, CC BY-SA 3.0, Frances Mc Fadden). Credit it on screen, and don't imply it's St. Louis.
2. **Photo with boxes.** Only 1 of the 15 street photos at dumping hotspots has dumping flagged (4700 Plover Ave), and it shows a fenced private yard with a "No trespassing" sign. Don't show it as illegal dumping. At 8440 N Broadway the photo shows nothing flagged. Say that plainly ("the latest photo shows the spot clear right now"), or show boxes on an eval photo during the accuracy beat.
3. **Name.** The app header says "StreetSense"; the pitch says "Dumping Radar". Pick one before recording.
4. **"Night before."** That is our reading of the report times, not a measurement. Keep the "likely" in the voiceover.

## How the photos get in (if a judge asks)

Nobody takes screenshots. `app/scripts/fetch-building-photos.mjs` asks Mapillary's public street-imagery API for the nearest recent photo at each top hotspot, downloads it and runs `/api/frames` on it. Mapillary also accepts uploads from ordinary dashcams, which is how city fleet vehicles could keep photos fresh. We do not connect to police or city security cameras, and we never run face or plate recognition.

## Recording checklist

- Record from a warmed local instance with `DEMO_CACHE=1`, and click **Write plan** once before recording so the plan comes back instantly. Never present a cached reply as a new live response.
- `DEMO_CACHE=1` only persists on a local machine (Vercel's file system is read-only).
- Groq's free vision tier allows about 95 photos a day. Don't re-run the eval on recording day.
- Use the same clicks every take. If the live app fails, narrate the same steps over the recorded walkthrough.
- The personal story (why this matters to each of us) is ours to tell in our own words. Don't script it with AI.

## Submission (from the organizer doc)

- Upload the video to YouTube as **Unlisted** or **Public**, not Private. Paste the link under "Post your video link below" at the bottom of the organizer doc.
- Upload the project folder to the hackathon Dropbox (link under "Upload your project" in the same doc).
- Add our names under Problem Set #3 in the doc's team sign-up.
- Our submit-by time: Thu Oct 15, 4:30pm CT.
