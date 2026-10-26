// Daily budgets for the AI routes, on top of the per-minute rate limit in guard.ts.
//
// The rate limiter stops one client hammering the server in a burst. It does nothing about the
// real constraint: the free Groq vision tier is roughly 95 photos a day for the whole
// organisation, shared by every key in it. A handful of people using the photo check politely,
// one at a time, would still exhaust it before lunch. So there are two budgets here: one per
// client, and one for the whole deployment.

/** One client's use of one route, inside one day. */
export type Window = { day: string; count: number };

export type Quota = {
  allowed: boolean;
  /** Calls left for this client today, after this one. */
  remaining: number;
  limit: number;
  /** Seconds until the day rolls over and the budget resets. */
  resetsIn: number;
};

/**
 * The calendar day in St. Louis. Not UTC: a supervisor reading "12 photo checks left today" should
 * see it reset overnight where they are, not at 7pm.
 */
export function cityDay(now: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date(now));
}

/** Seconds until midnight in St. Louis. */
export function secondsUntilCityMidnight(now: number): number {
  const day = cityDay(now);
  // Walk forward in hours until the date flips, then narrow to the second. Cheap, and it needs no
  // time-zone table of its own, so it cannot disagree with cityDay() about when the day ends.
  let t = now;
  for (let i = 0; i < 48 && cityDay(t) === day; i++) t += 3_600_000;
  while (cityDay(t - 1000) !== day) t -= 1000;
  return Math.max(1, Math.round((t - now) / 1000));
}

/**
 * Counts one call against a daily budget. Returns what is left; when it is over, `allowed` is
 * false and nothing is charged, so a refused call does not dig the hole deeper.
 */
export function consume(store: Map<string, Window>, key: string, limit: number, now: number): Quota {
  const day = cityDay(now);
  const resetsIn = secondsUntilCityMidnight(now);
  const current = store.get(key);
  const used = current && current.day === day ? current.count : 0;

  if (used >= limit) return { allowed: false, remaining: 0, limit, resetsIn };

  if (store.size > 10_000 && !current) store.clear(); // keep memory bounded if many clients show up
  store.set(key, { day, count: used + 1 });
  return { allowed: true, remaining: limit - used - 1, limit, resetsIn };
}

/** Reads a budget without charging it, for /api/health. */
export function peek(store: Map<string, Window>, key: string, limit: number, now: number): Quota {
  const day = cityDay(now);
  const current = store.get(key);
  const used = current && current.day === day ? current.count : 0;
  return { allowed: used < limit, remaining: Math.max(0, limit - used), limit, resetsIn: secondsUntilCityMidnight(now) };
}
