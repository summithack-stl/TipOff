# How TipOff works

`app/` is a Next.js/React app in TypeScript, styled with Tailwind and shadcn/ui. Leaflet draws the hotspot map. Pages include the map, daily crew board, photo report form and photo checker. A browser service worker caches opened pages, map tiles and plans for the PWA.

Python/pandas scripts in `data/scripts/` clean St. Louis 311 and vacant-building records, score repeat hotspots and backtest the scores. A TypeScript port in `app/src/lib/refresh/` runs through Vercel Cron and publishes refreshed data to Blob; bundled JSON remains the fallback. Historical 311 data covers St. Louis City only.

Server API routes validate inputs and call Groq/Gemini through server-only model helpers. Plans use sourced hotspot facts. Photo reports are accepted within St. Louis City, Ballwin and Chesterfield; qualified reports contribute to block-level hotspots. Reporter hashes limit repeat contributions but do not verify people. Current report photos/records are public Blob objects, although the public report API returns only aggregate hotspots.

`ios/TipOff/` is a SwiftUI/WebKit shell loading the live crew board; it is separate from the installable browser PWA and has no bundled offline site. The Remotion video lives in the separate `tipoff-video` repository.

To extend the app, reuse the existing components and server helpers. Keep missing municipal history distinct from zero, model keys server-side, and native-shell claims separate from PWA behavior.
