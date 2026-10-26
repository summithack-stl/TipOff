import { consume, peek, type Quota, type Window as Day } from "./quota.ts";

// Shared protection for the public API routes: per-client rate limits, daily AI budgets, and
// errors that don't leak internals.

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

// --- Daily AI budgets ---------------------------------------------------------------------------
//
// The rate limit above stops a burst. It does nothing about the real constraint: the free Groq
// vision tier is roughly 95 photos a DAY for the whole organisation. A few people using the photo
// check politely would still exhaust it before lunch, so each route has a per-client budget and a
// budget for the whole deployment.
export const DAILY_LIMITS = {
  // Photo checks are the scarce one: they spend the shared vision tier.
  frames: { anon: 5, signedIn: 40, org: 90 },
  // Plans are cheaper and cached per hotspot, so a whole crew opening the same block costs one call.
  plan: { anon: 20, signedIn: 100, org: 400 },
} as const;

export type AiRoute = keyof typeof DAILY_LIMITS;

// ponytail: in-memory per server instance, same caveat as the rate limiter above. The org budget
// is therefore per instance too, so it is a floor on protection, not a hard cap. Move both to
// Vercel KV / Upstash when the app gets real traffic.
const budgets = new Map<string, Map<string, Day>>();
const store = (route: AiRoute): Map<string, Day> => {
  let s = budgets.get(route);
  if (!s) budgets.set(route, (s = new Map()));
  return s;
};

const ORG = "__org__";

/**
 * Charges one call against today's budgets. Returns a 429 when the client or the whole deployment
 * is out, otherwise null.
 *
 * `signedIn` is false everywhere today: nothing verifies a session server-side yet, and trusting
 * an unverified claim would mean anyone could ask for the bigger budget. It turns on with the
 * Supabase wiring, not before.
 */
export function dailyQuota(request: Request, route: AiRoute, signedIn = false): Response | null {
  const limits = DAILY_LIMITS[route];
  const now = Date.now();
  const s = store(route);
  const mineKey = `ip:${clientKey(request)}`;
  const myLimit = signedIn ? limits.signedIn : limits.anon;

  // Look before charging either budget. Charging the shared one and then refusing on the client's
  // would let a single phone that is already over its own allowance burn the whole team's.
  const org = peek(s, ORG, limits.org, now);
  if (!org.allowed) return quotaRefusal(route, org, "Today's AI budget for the whole team is spent.");

  const mine = peek(s, mineKey, myLimit, now);
  if (!mine.allowed) return quotaRefusal(route, mine, "You have used today's allowance for this.");

  consume(s, ORG, limits.org, now);
  consume(s, mineKey, myLimit, now);
  return null;
}

function quotaRefusal(route: AiRoute, quota: Quota, why: string): Response {
  const hours = Math.round(quota.resetsIn / 360) / 10;
  return Response.json(
    { error: `${why} It resets at midnight, in about ${hours} h.`, route, limit: quota.limit, remaining: 0 },
    {
      status: 429,
      headers: {
        "Retry-After": String(quota.resetsIn),
        "X-Quota-Limit": String(quota.limit),
        "X-Quota-Remaining": "0",
      },
    },
  );
}

/** What is left today, without spending any of it. For /api/health, so a supervisor can see it. */
export function quotaStatus(): Record<AiRoute, { remaining: number; limit: number; resetsIn: number }> {
  const now = Date.now();
  const read = (route: AiRoute) => {
    const { remaining, limit, resetsIn } = peek(store(route), ORG, DAILY_LIMITS[route].org, now);
    return { remaining, limit, resetsIn };
  };
  return { frames: read("frames"), plan: read("plan") };
}
