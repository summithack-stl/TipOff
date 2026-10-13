# Three-minute demo script

Replace every bracketed item before rehearsing. Use the same inputs and clicks in rehearsal and on stage.

| Time | Beat | Say and show |
| --- | --- | --- |
| 0:00–0:20 | Hook | “In St. Louis, [person or group] faces [specific friction]. Today we can [outcome] in [short time].” Show [one compelling screen or local fact]. |
| 0:20–0:45 | Problem | “The current process is [painful step]. That matters because [consequence].” Credit [dataset/source] for the evidence on screen. |
| 0:45–1:55 | Live demo | 1. Open [deployed URL] and choose [starting point]. 2. Enter **[exact prepared prompt/input]** and submit. 3. Point out [result and why it helps]. 4. Show [one follow-up action or second prepared prompt]. Keep clicks to the rehearsed path. |
| 1:55–2:20 | Tech | “We built [short architecture]. [Dataset] supplies [data]; [LLM/provider] handles [specific task].” Show [one diagram or relevant screen], without reading code. |
| 2:20–2:45 | Impact | “For [user], this could save [measurable amount] or improve [measurable outcome]. We have [evidence from test/user feedback], and still need to validate [open question].” |
| 2:45–3:00 | Ask | “We want [specific next step: pilot, feedback, partner, or data access]. Try it at [URL].” End on [QR code/contact]. |

## Outage fallback

Before the demo, set `DEMO_CACHE=1` in the deployed demo environment. While the LLM works, pre-run **every exact prompt** and input sequence in this script to populate the prompt-hash cache. Confirm the resulting cache survives deployment or process restart, then rehearse the same sequence with the provider unavailable. If it cannot, keep the warmed local instance for the demo. Do not edit prompt wording or model settings after warming; a changed request can miss the cache.

If the LLM fails on stage, repeat the prepared prompts with `DEMO_CACHE=1` and continue through the cached responses. If the app itself is unavailable, switch to [recorded walkthrough or screenshots] and narrate the same steps. Have [backup device/network] ready. Never present cached output as a new live model response.
