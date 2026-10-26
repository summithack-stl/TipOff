You are working in the TipOff repo (github.com/summithack-stl/summithack). TipOff ranks the St. Louis blocks where illegal dumping keeps coming back, from the City's 311 data, and writes a camera and cleanup plan for each one. It's a Next.js 16 App Router app in `app/`, deployed on Vercel at https://summithack-blond.vercel.app. There's also a small native iOS wrapper in `ios/TipOff` (SwiftUI + WKWebView, built with xtool) that loads the live site full screen.

Read `CLAUDE.md`, `app/AGENTS.md` and `README.md` first and follow them: strict TypeScript, no `any` or `@ts-ignore`, LLM calls only through `app/src/lib/llm.ts`, never call city APIs live, conventional commits, small PRs (under 300 changed lines, one concern each), and CI (lint, typecheck, build) green before merge. Never commit secrets. Don't add Co-Authored-By trailers.

## Goal

Make TipOff something several people can install and use on their own phones at the same time: city crews in the field, a supervisor at a desk, and judges trying it out. Today it's a one-person desktop demo. Take on a lot. Do the work in the priority order below and open one PR per numbered item, so finished pieces can merge while the rest is still in progress.

## Team split — don't step on these

- **Sarthak** is restructuring the UI: layout, visual design, navigation and page structure. Don't restyle pages or move components around. When something below needs UI, build the smallest functional version using the existing shadcn components, and put a `// UI: Sarthak` comment where he'll want to restyle it. Keep logic out of components (in `app/src/lib` or hooks) so his restructure doesn't break it.
- **Vedant** owns the submission: the video, the form, the write-up. Don't edit `docs/video-*` or submission text.
- **You** own everything else: making it work on phones, multi-user, data, backend, performance, the iOS wrapper, and reliability.

## What we found on a phone (390×844, iOS Safari user agent, live site, 2026-10-25)

- No web manifest and no icons: `/manifest.webmanifest`, `/manifest.json`, `/apple-touch-icon.png` and `/favicon.ico` all return 404. "Add to Home Screen" gives a blank icon and opens with Safari chrome around the page.
- `/map` returns **2.5 MB of HTML**, because the hotspot data is inlined into the page. That's slow on cellular.
- On the map, the filter panel covers about a third of the screen and can't be collapsed. 900 circles overlap, with no clustering.
- The hotspot counts disagree: the landing page says "1,186 dumping hotspots ranked", the map says "900 of 900 repeat hotspots", and the README says 1,173.
- On `/crew`, the "Suggested watch" for the #1 hotspot is "12am–12pm": a 12-hour window, which isn't useful advice. Check the window logic in `app/src/lib/crew.ts`.
- On `/crew`, raw 311 text shows up unedited ("Illegal dumpg report"). Map 311 problem codes to readable labels.
- On `/watch`, the detection labels run off the right edge of the photo ("Open entry 90" is clipped). It's also the old vacant-building demo. Decide whether it stays reachable.
- Nothing is shared between users. A crew can't mark a block cleaned, and the next person sees nothing.
- The free Groq vision tier allows about 95 photos a day **for the whole org**, so a few people using the photo check would exhaust it before lunch.
- The iOS wrapper has no camera or location usage descriptions in `Info.plist`. A WKWebView page that opens a camera `<input>` or asks for geolocation will be refused, or the app will crash.

## Work, in priority order

### 1. Installable on any phone (PWA)
- Add `app/src/app/manifest.ts` (Next metadata route): name, short_name "TipOff", `display: "standalone"`, `start_url: "/crew"` (crews open the app to today's list), theme and background colors that match the current dark theme, and icons at 192, 512 and maskable 512.
- Add `apple-touch-icon` (180), `icon` and favicon via Next's file conventions. The source icon is `ios/TipOff/icon/icon.svg`: reuse it.
- Add `appleWebApp` metadata (`capable`, `statusBarStyle: "black-translucent"`, title) and `viewport` `themeColor` in `app/src/app/layout.tsx`. Respect `env(safe-area-inset-*)` so nothing sits under the notch or home bar in standalone mode.
- Add a short "Install on your phone" section to the landing page: the iOS steps (Share → Add to Home Screen) and the Android install prompt (handle `beforeinstallprompt`).

### 2. Works with bad or no signal (crews are outside)
- Add a service worker (hand-written `public/sw.js` registered from a small client component, or Serwist if that fits Next 16 cleanly; no other new dependencies). Cache the app shell, `/crew`, the hotspot JSON and map tiles already viewed.
- Cache plans the user has opened, so a crew can read them offline.
- Show a small offline banner. Queue writes from item 4 while offline and sync them when the connection comes back.

### 3. Fast on a phone
- Stop inlining hotspot data into `/map`. Serve it as a static, cacheable JSON file (generated at build time from `app/data/clean`), slimmed to the fields the map needs, and fetch it on the client. Load full detail per hotspot on demand. Target: `/map` HTML under 100 KB.
- Cluster markers at low zoom (a small hand-rolled grid cluster is fine; Leaflet.markercluster only if it stays small).
- Make the hotspot counts consistent everywhere, with one source of truth in `app/src/lib/hotspots.ts`. Say what each number counts.
- Run Lighthouse in mobile mode on `/`, `/map` and `/crew`, and put before/after numbers in the PR.

### 4. Multi-user: shared crew status
This is the core of "several people use it at once."
- Backend: Supabase (Aarnav set up a project during the hackathon; check `app/.env.example` and ask in the PR if the URL or keys are missing). If Supabase isn't available, use Vercel KV/Postgres. Pick one and write down why in the PR.
- Table `hotspot_status`: hotspot_id, status (`open` | `cleaned` | `camera_placed` | `needs_followup`), note, photo_url (optional), updated_by, updated_at. Keep a history table, or append-only rows, so a supervisor can see what happened on each block.
- Auth that fits city staff on phones: email magic link, plus a **team join code**, so a supervisor can invite a crew without creating accounts by hand. Roles: `viewer` (default, read-only: judges and the public), `crew` (can update status), `supervisor` (can invite people and assign blocks). Enforce roles with row-level security, not only in the UI.
- Read-only must still work with no login, so judges and the public see the map and plans exactly as today.
- On `/crew` and in the hotspot panel: status, last updated by and when, and buttons to mark cleaned, camera placed or needs follow-up, plus a note. Use realtime updates if Supabase is in place; otherwise poll every 30 s.
- Assignments: a supervisor can assign today's blocks to a crew member, and "My blocks" filters to them.
- Re-check loop: show reports on a block since it was marked cleaned (the README's "measure a month later" step). If reports don't drop, flag it.

### 5. Report from the phone
- A "Report" action on a hotspot (and a standalone `/report` page) that takes a photo with `<input type="file" accept="image/*" capture="environment">`, attaches GPS from `navigator.geolocation` with permission, and sends it to the existing `POST /api/frames`. Resize on the client to at most 1600 px and under 4 MB before upload.
- Save the result to the shared status from item 4, so the photo and detections appear for everyone on that block.

### 6. AI limits that survive several users
- Per-user and per-IP daily quotas on `/api/frames` and `/api/plan`, on top of the existing rate limiter in `app/src/lib/guard.ts`. Signed-in crew get more.
- Cache plans by hotspot id plus a data-version hash (extend `app/src/lib/cache.ts`), so ten people opening the same plan cost one LLM call. Precompute plans for the top 50 hotspots in the nightly `refresh-data.yml` job.
- When vision quota runs out, fall back to Gemini, which already happens. If that fails too, save the photo with "AI check pending" and retry later. Never lose the report.
- Have `/api/health` report remaining quota so a supervisor can see it.

### 7. Field-friendly details
- Every address opens directions: an Apple Maps link on iOS, Google Maps elsewhere (`maps://` / `geo:` with an https fallback).
- "Share this block" uses the Web Share API with a deep link to `/map?h=<id>`, and `/map` opens that hotspot from the query string.
- Today's list follows the device's local day, and the day picker's "(today)" label is right at midnight.
- Readable 311 labels (see findings). A realistic "Suggested watch" window: never longer than 6 hours, and say plainly when the data is too thin to suggest one.
- Fix the `/watch` overlay labels so they stay inside the image.

### 8. iOS wrapper (`ios/TipOff`)
- Add `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` and `NSLocationWhenInUseUsageDescription` to `Info.plist`, with plain-English reasons.
- Handle the WKWebView geolocation and media-capture permission prompts (`WKUIDelegate` `requestMediaCapturePermissionFor`).
- Start at `/crew` to match the PWA. Keep `/map`, `/crew`, `/report` and auth callbacks inside the app, and open everything else in Safari (already done for other hosts).
- Make the magic-link login work inside the wrapper: register a URL scheme or universal link and hand the session back into the WKWebView.
- Respect the top safe area (the status bar currently overlaps on notched phones).
- Add a GitHub Actions job that builds an **unsigned** `.app`/`.ipa` with xtool on Linux and uploads it as an artifact, so teammates can sideload it with SideStore or AltStore without this laptop. Write in `ios/TipOff/README.md` that free Apple IDs are limited to 3 sideloaded apps per phone and 7-day expiry, and that the PWA is the main way people should install TipOff.

### 9. Hardening for real users
- Validate every API input with zod (some routes already do; make it all of them).
- Content-Security-Policy and other security headers in `next.config.ts`, with Leaflet tiles and Mapillary allowed.
- Make sure no API key reaches the client bundle. Grep the built `.next` output.
- Basic privacy page: no face or plate recognition, what's stored for signed-in users, and how to delete an account.
- Add error reporting that doesn't need a paid service: log to Vercel, and surface failures in the UI as clear messages, never blank screens.

### 10. Tests
- `node --test` unit tests for the crew window logic, label mapping, quota logic and the offline write queue.
- A Playwright mobile-viewport smoke test (iPhone 14 device profile): landing loads, `/map` renders markers, `/crew` lists hotspots, the manifest is valid, and the service worker registers. Run it in CI.

## Definition of done (for each PR)
- `npm run lint`, `npm run typecheck`, `npm run build` and the tests pass. Paste the summary lines into the PR.
- For any user-visible change: a screenshot at 390×844.
- For item 4: a short recording, or a step list, of two different browsers seeing each other's status change.
- Update `README.md` (setup, new env vars, how to install on a phone) and `app/.env.example`.
- End with a plain list of anything a human has to do: Supabase keys, Vercel env vars, DNS or URL settings, Apple ID steps.
