// What the refresh remembers about itself, and the rules for changing it. Pure, so the rules are
// tested; refresh/store.ts reads and writes it, refresh/run.ts drives it.

export type Counts = Record<string, number>;

export type RunRecord = {
  at: string; // ISO time the run finished, or was refused
  by: string; // "cron", or who asked
  ok: boolean;
  ms?: number;
  error?: string; // why it failed, in words a supervisor can act on
  runId?: string;
  windowEnd?: string; // the newest 311 report in the data
  counts?: Counts; // hotspots per category
  reports?: number; // street reports kept
};

export type RefreshStatus = {
  lastSuccess: RunRecord | null;
  lastAttempt: RunRecord | null;
  running: { since: string; by: string } | null;
  history: RunRecord[]; // newest first
};

export const EMPTY_STATUS: RefreshStatus = { lastSuccess: null, lastAttempt: null, running: null, history: [] };
export const HISTORY = 14;
// A run that never finished (a function killed at its time limit) stops blocking after this long.
export const STALE_MS = 15 * 60_000;

export function canStart(s: RefreshStatus, now: number): { ok: true } | { ok: false; reason: string } {
  if (s.running && now - Date.parse(s.running.since) < STALE_MS) {
    return { ok: false, reason: `A refresh started by ${s.running.by} is already running (since ${s.running.since}).` };
  }
  return { ok: true };
}

export const started = (s: RefreshStatus, by: string, now: number): RefreshStatus => ({ ...s, running: { since: new Date(now).toISOString(), by } });

export function finished(s: RefreshStatus, run: RunRecord): RefreshStatus {
  return {
    lastSuccess: run.ok ? run : s.lastSuccess,
    lastAttempt: run,
    running: null,
    history: [run, ...s.history].slice(0, HISTORY),
  };
}

export type SnapshotFacts = { reports: number; counts: Counts; windowEnd: string };

/**
 * Why a new build must not replace the current one, or null when it may. A refresh that goes wrong
 * quietly (a truncated download, a changed column, a stale file) should fail loudly and leave
 * yesterday's data up, not publish a city with half its hotspots missing.
 */
export function refuseSnapshot(next: SnapshotFacts, prev: SnapshotFacts | null): string | null {
  if (next.reports < 10_000) return `Only ${next.reports} street reports came out of the city file (usually ~40,000).`;
  for (const c of ["dumping", "pothole", "graffiti"]) {
    if (!next.counts[c]) return `No ${c} hotspots came out of the build.`;
  }
  if (!prev) return null;
  if (next.windowEnd < prev.windowEnd) return `The city file ends ${next.windowEnd}, older than the data already published (${prev.windowEnd}).`;
  const total = (c: Counts) => Object.values(c).reduce((a, b) => a + b, 0);
  if (total(next.counts) < 0.5 * total(prev.counts)) {
    return `The build has ${total(next.counts)} hotspots, under half of the ${total(prev.counts)} published now.`;
  }
  return null;
}
