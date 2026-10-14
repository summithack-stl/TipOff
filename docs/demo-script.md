# Two-minute video script: Vacant Building Danger Radar

The judges see only this video plus our story. Every number on screen must come from city open data or our own measured test. Never say the score predicts collapse: it orders buildings for inspection.

| Time | On screen | Voiceover (draft) | What it proves |
| --- | --- | --- | --- |
| 0:00–0:15 | Cold open: the 2700 N Grand Blvd street photo, a roofless brick shell. Hazard boxes draw on one by one. | "In January 2022, a St. Louis firefighter died when the roof of a vacant building collapsed." (Team decides: name him or not.) | It matters. |
| 0:15–0:30 | Map fills with the 9,884 vacant buildings, colored by inspection priority. | "St. Louis has almost ten thousand vacant buildings. Inspectors and fire crews can't check them all. Which one first?" | Scale, and the decision we answer. |
| 0:30–1:20 | One user, one building. "It's Monday. You're a fire captain." Click #1, **1221 Hebert St**. Reasons appear: 29 major code violations, on the vacant list 9+ years, built 1890. The street photo opens with hazard boxes. Click "brief": the firefighter brief appears in about 2 s. | "City records rank every vacant building. AI checks the latest street photo for open entries, roof, wall and fire damage, and writes a brief a crew can read before a call." | It works on real addresses, records and photos. |
| 1:20–1:35 | The accuracy result from `app/eval/` and the data sources. | "We hand-checked [X] photos: it found [Y of Z] hazards with [N] false alarms. Every number comes from city open data." | Not a mockup. |
| 1:35–1:50 | Coverage map: only about 7% of the riskiest buildings have a recent street photo within 50 m. Quick cut of the same pipeline flagging a pothole, a broken curb and dumping. | "The most dangerous blocks are the ones nobody photographs. City vehicles that already drive every street could close that gap, and the same system flags potholes, broken curbs and dumping for 311." | Insight and room to grow. |
| 1:50–2:00 | Who uses it, and the link. | "Built for the Building Division and the Fire Department. Open source, runs on free tiers. [URL]" | Adoptable. |

The personal story (why this matters to each of us) is ours to tell in our own words. Don't script it with AI.

## How the photos get in (if a judge asks)

Nobody takes screenshots. `app/scripts/fetch-building-photos.mjs` takes the city's vacant building list, asks Mapillary's public street-imagery API for the nearest recent photo that faces each building, downloads it and runs `/api/frames` on it. Mapillary also accepts uploads from ordinary dashcams and 360 cameras, which is how city fleet vehicles could keep photos fresh. `/api/frames` takes a frame from any camera, but we do not connect to police or city security cameras.

## Recording checklist

- Record from a warmed local instance, or use the saved detections in `app/public/photos/index.json`. Groq's free vision tier allows about 95 photos a day.
- `DEMO_CACHE=1` only persists on a local machine (Vercel's file system is read-only).
- Use the same clicks every take. Never present a cached reply as a new live response.
- If the live app fails, narrate the same steps over the recorded walkthrough.
