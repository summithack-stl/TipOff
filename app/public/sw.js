/*
 * TipOff service worker. Hand-written: no build step and no new dependency.
 *
 * Crews use this outside, where signal is bad or gone. What has to survive that:
 *   - the app shell and the pages they actually opened (/crew above all),
 *   - the hotspot data, so the map and the list still have something to draw,
 *   - the plans they opened, so a block's plan can be read with no signal at all,
 *   - the map tiles they already looked at.
 *
 * Bump VERSION to retire every old cache at once.
 */
const VERSION = "v1";
const SHELL = `tipoff-shell-${VERSION}`;
const DATA = `tipoff-data-${VERSION}`;
const TILES = `tipoff-tiles-${VERSION}`;
const PLANS = `tipoff-plans-${VERSION}`;
const MINE = new Set([SHELL, DATA, TILES, PLANS]);

// Tiles are the one cache that grows without a ceiling, so it gets a crude cap.
const MAX_TILES = 600;

// Pre-cached so a cold install still opens offline. /crew is the app's start_url.
const PRECACHE = ["/crew", "/map", "/offline"];

self.addEventListener("install", (event) => {
  // Best effort: one 404 must not fail the whole install.
  event.waitUntil(
    caches.open(SHELL).then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url)))).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("tipoff-") && !MINE.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Keep a cache from growing forever. Oldest entry first, which for tiles is close enough to LRU. */
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/** Fresh when we can reach the network, cached when we cannot. For pages. */
async function networkFirst(request, cacheName, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const hit = (await cache.match(request)) || (fallback && (await cache.match(fallback)));
    if (hit) return hit;
    throw new Error("offline and not cached");
  }
}

/** Answer from cache at once, refresh in the background. For the hotspot data. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  const response = hit || (await fresh);
  if (!response) throw new Error("offline and not cached");
  return response;
}

/** Never changes once fetched. For hashed build assets and map tiles. */
async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    await cache.put(request, response.clone());
    if (max) void trim(cacheName, max);
  }
  return response;
}

/*
 * Plans are a POST, which the Cache API will not store, so each one is kept under a synthetic GET
 * key built from the hotspot id. A crew that opened a plan with signal can read it again without.
 */
const planKey = (id) => new Request(`${self.location.origin}/__cached-plan/${encodeURIComponent(id)}`);

async function handlePlan(request) {
  // The body can only be read once, so take a copy before it goes to the network.
  const body = await request.clone().json().catch(() => null);
  const id = body && typeof body.id === "string" ? body.id : null;
  const cache = await caches.open(PLANS);
  try {
    const response = await fetch(request);
    if (response.ok && id) await cache.put(planKey(id), response.clone());
    return response;
  } catch (error) {
    const hit = id && (await cache.match(planKey(id)));
    if (hit) {
      // Tell the page this is the copy from last time, not a fresh answer.
      const headers = new Headers(hit.headers);
      headers.set("x-tipoff-offline", "cached");
      return new Response(hit.body, { status: hit.status, headers });
    }
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/api/plan") {
    event.respondWith(handlePlan(request));
    return;
  }
  // Everything else we touch is a GET. Never interfere with writes.
  if (request.method !== "GET") return;

  // Map tiles are cross-origin and immutable.
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(cacheFirst(request, TILES, MAX_TILES));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Hashed by the build, so they can never go stale.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, SHELL));
    return;
  }
  // The hotspot data: show something immediately, catch up in the background.
  if (url.pathname === "/api/hotspots" || url.pathname === "/api/vacant" || url.pathname.startsWith("/api/hotspots/")) {
    event.respondWith(staleWhileRevalidate(request, DATA));
    return;
  }
  // Live calls: a stale answer would be worse than an honest failure.
  if (url.pathname.startsWith("/api/")) return;

  // Pages. Falling back to /offline keeps a crew off the browser's error page.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL, "/offline"));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, SHELL));
});
