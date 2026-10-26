import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canStart, EMPTY_STATUS, finished, HISTORY, refuseSnapshot, STALE_MS, started } from './refresh/status.ts';

const now = Date.parse('2026-10-26T10:00:00Z');

test('one refresh at a time, unless the running one is clearly dead', () => {
  assert.equal(canStart(EMPTY_STATUS, now).ok, true);
  const busy = started(EMPTY_STATUS, 'cron', now);
  const refused = canStart(busy, now + 60_000);
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /started by cron is already running/);
  assert.equal(canStart(busy, now + STALE_MS + 1).ok, true, 'a run killed at its time limit stops blocking');
});

test('a finished run clears the lock and is remembered; a failure keeps the last success', () => {
  const good = { at: '2026-10-26T10:00:20Z', by: 'cron', ok: true, runId: 'r1', windowEnd: '2026-10-25' };
  const bad = { at: '2026-10-27T10:00:05Z', by: 'cron', ok: false, error: 'the city answered 503' };
  const s1 = finished(started(EMPTY_STATUS, 'cron', now), good);
  const s2 = finished(started(s1, 'cron', now), bad);
  assert.equal(s2.running, null);
  assert.equal(s2.lastAttempt, bad);
  assert.equal(s2.lastSuccess, good);
  assert.deepEqual(s2.history, [bad, good]);
  let s = s2;
  for (let i = 0; i < 20; i++) s = finished(s, bad);
  assert.equal(s.history.length, HISTORY);
});

const facts = (over = {}) => ({ reports: 40_000, counts: { dumping: 1186, pothole: 1420, graffiti: 344 }, windowEnd: '2026-10-25', ...over });

test('a sound build may replace the published one', () => {
  assert.equal(refuseSnapshot(facts(), null), null);
  assert.equal(refuseSnapshot(facts({ windowEnd: '2026-10-26' }), facts()), null);
});

test('a build that went wrong quietly is refused, and says why', () => {
  assert.match(refuseSnapshot(facts({ reports: 900 }), null), /Only 900 street reports/);
  assert.match(refuseSnapshot(facts({ counts: { dumping: 10, pothole: 10 } }), null), /No graffiti hotspots/);
  assert.match(refuseSnapshot(facts({ windowEnd: '2026-10-01' }), facts()), /older than the data already published/);
  assert.match(refuseSnapshot(facts({ counts: { dumping: 500, pothole: 600, graffiti: 100 } }), facts()), /under half/);
});
