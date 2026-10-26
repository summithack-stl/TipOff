# TipOff: 2-minute video script

**One sentence (everyone should be able to say this):** TipOff turns St. Louis's 311 reports into a daily tip-off: where illegal dumping keeps coming back, when it gets reported, and what a crew should do about it.

**The story in four beats:** dumping is a big, expensive problem. It isn't random; it comes back to the same blocks. TipOff finds those blocks and writes the plan. We tested it, and it works.

Word budget: about 250 spoken words in total (people talk at about 150 words a minute, and the opening is music only). Stay inside your count. The lines below are a draft; say them in your own words, but keep every number exactly as written.

## Run of show

| # | Time | Who | Words | On screen |
|---|---|---|---|---|
| 1 | 0:00-0:08 | nobody (music + sound effects) | 0 | Dumping photo, AI boxes snap on, camera pulls back to the city map, 1,173 red dots light up, **TipOff** title |
| 2 | 0:08-0:30 | Sarthak | ~55 | Face 2-3 s, then kinetic number cards |
| 3 | 0:30-0:38 | Arjun | ~25 | Face 2 s, then counter 0 to 40,426, dots collapsing into blocks |
| 4 | 0:38-1:08 | Prahlad | ~75 | Face 2 s, then cinematic app footage |
| 5 | 1:08-1:16 | Vedant | ~20 | Face 2 s, then the crew view in a phone frame |
| 6 | 1:16-1:40 | Aarnav | ~55 | Face 2-3 s, then the architecture animation |
| 7 | 1:40-1:52 | Prahlad (voice only) | ~25 | Backtest card: 42 / 50 |
| 8 | 1:52-2:00 | Sarthak, then everyone | ~15 | Face, then a 5-person call grid, end card with link |

## Lines (draft)

**2. Sarthak, the problem**
> St. Louis got over six thousand dumping and debris reports last year. The city doubled the fine to a thousand dollars, but its cameras can't catch faces or license plates clearly enough to use. So the city asked a different question: where, and when, should we be looking?
> *[Your personal why, about 8 seconds, your own words]*

**3. Arjun, the data**
> We pulled three years of the city's 311 reports, forty thousand of them, and grouped them by block. And dumping isn't random. It keeps coming back to the same spots.
> *[One-line personal why]*

**4. Prahlad, the demo**
> This is TipOff. Every red dot is a block where dumping keeps coming back. Number one: 8440 North Broadway. 26 reports in the last year, up from 10. Reported in 14 different weeks, with 13 vacant buildings nearby. Our AI also scans street photos near hotspots for dumping piles. Then it writes the plan: where to put a camera, when to watch, and what evidence a citation needs.
> *[Personal why, about 5 seconds]*

**5. Vedant, the crew view**
> Every morning, a crew opens this on their phone: today's hotspots, when to watch, and what to do.
> *[One-line personal why]*

**6. Aarnav, how it works**
> Under the hood: the city's open data, cleaned in Python. A score ranks every block by how often it's reported, how steadily, whether it's growing, and how many vacant buildings sit nearby. A vision model on Groq checks street photos, and Gemini double-checks. And no faces, no license plates. We track places and times, never people.
> *[Personal why, about 8 seconds]*

**7. Prahlad, the proof (voice over the card)**
> Does it work? We hid the last year of data from it. Of its top 50 blocks, 42 got dumped on again. Nine of its top ten.

Text on the card only, not spoken: "311 report times aren't dumping times. Crews still verify on site."

**8. Sarthak, the close**
> For the Citizens' Service Bureau, refuse crews and code enforcement: stop chasing piles. Get the tip-off.
> *Everyone, on the call grid:* "We're TipOff."

## Fact sheet (only say numbers from this list)

| Fact | Number | Source |
|---|---|---|
| 311 reports used | 40,426 (Jan 2024 to Oct 2026) | `app/data/clean/street_reports.json` |
| Dumping and debris reports (all dumping + debris codes; only 2,157 use the "Illegal dumping" code) | 15,342 total; 6,200 in 2025 | same |
| Dumping hotspots | 1,173 blocks (about 155 m squares) | `hotspots_summary.json` |
| #1 hotspot | 8440 N Broadway, Ward 13, score 78. 26 reports in the last 12 months vs 10 the year before. Reported in 14 different weeks. 13 vacant buildings within 150 m. Most reports come in Wednesdays, 5-8am | `hotspots.json` |
| Backtest | Scored as of Oct 14 2025, checked the next 12 months: 9 of the top 10 and 42 of the top 50 got dumped on again (83 of the top 100) | `data/scripts/backtest.py` |
| Score | recent volume 40%, different weeks reported 30%, trend 15%, vacant buildings nearby 15% | `data/scripts/build_hotspots.py` |
| Fine doubled to $1,000; cameras can't read plates or faces | from the organizer problem set | confirm the wording against the organizer doc |

**Photo note:** the opening dumping photo is a 1970s US National Archives photo (public domain), not St. Louis. Never call it St. Louis. The #1 hotspot's own street photo has nothing flagged in it.

**Never say:** "predicts crime", "catches dumpers", "identifies people", or "when dumping happens" (we only know when it gets reported).

## How to say it

- Talk to one person, not to "an audience". Picture explaining it to a friend.
- One fact per sentence, then a short pause after each number so it lands.
- Go about 10% slower than feels natural. Nerves speed everyone up.
- Don't read off a screen; your eyes give it away. Learn the beats, not the exact words.
- The first take is a warm-up. Do 3 and send the best two.
- Smile on your first word. Energy reads lower on camera than it feels.

## Recording (everyone, remote)

- **Record video, not audio only.** The edit shows your face for 2-3 seconds with your name on screen, then your voice keeps going over the visuals. The video gives the editor both options.
- Phone sideways (landscape), at eye level, about an arm's length away. Window light in front of you, never behind you.
- Quiet room with soft stuff (bed, curtains); kitchens and bathrooms echo. Turn off fans.
- 1 second of silence before and after each take.
- Files: `<part#>-<name>-take<N>.mp4`, uploaded to the shared Drive folder by **Thu 10:00am CT**.
- **Team shot:** a 5-minute Google Meet in gallery view, recorded, with everyone saying "We're TipOff" together. Do 3 tries. That's the last 2 seconds of the video.
