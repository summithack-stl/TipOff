// Shared protection for the public API routes: per-client rate limits and errors that don't leak internals.

type Window = { start: number; count: number };

// Returns 0 when allowed, otherwise the seconds until the client's window resets.
export function hit(hits: Map<string, Window>, key: string, limit: number, windowMs: number, now = Date.now()): number {
  const w = hits.get(key);
  if (!w || now - w.start >= windowMs) {
    if (hits.size > 10_000) hits.clear(); // keep memory bounded if many clients show up
    hits.set(key, { start: now, count: 1 });
    return 0;
  }
  w.count += 1;
  return w.count > limit ? Math.ceil((w.start + windowMs - now) / 1000) : 0;
}

// Vercel sets x-forwarded-for to the real client address.
export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

// ponytail: in-memory per server instance, so the real limit is roughly limit x instances.
// Move to Vercel KV / Upstash if the app gets real traffic.
const buckets = new Map<string, Map<string, Window>>();

// Returns a 429 response when the client is over the limit, otherwise null.
export function rateLimit(request: Request, route: string, limit: number, windowMs = 60_000): Response | null {
  let hits = buckets.get(route);
  if (!hits) buckets.set(route, (hits = new Map()));
  const wait = hit(hits, clientKey(request), limit, windowMs);
  if (!wait) return null;
  return Response.json(
    { error: `Too many requests. Try again in ${wait} s.` },
    { status: 429, headers: { "Retry-After": String(wait) } },
  );
}

// Log the real error on the server; send the client a short message without keys, URLs or stack details.
export function upstreamError(route: string, error: unknown, extra: Record<string, unknown> = {}): Response {
  console.error(`${route} failed:`, error);
  // A missing key is a setup problem, not a flaky AI: say which variable to set (names only, never values).
  const unset = error instanceof Error && /^([A-Z]+)_(API_KEY|MODEL) is not set$/.exec(error.message);
  if (unset) {
    return Response.json(
      { error: `AI is not set up on this server: add ${unset[1]}_${unset[2]} to app/.env.local (see README, Run locally).`, ...extra },
      { status: 503 },
    );
  }
  const busy = error instanceof Error && error.name === "RateLimitError";
  return Response.json(
    { error: busy ? "That service is busy. Try again in a minute." : "That service failed. Try again.", ...extra },
    { status: busy ? 503 : 502 },
  );
}
