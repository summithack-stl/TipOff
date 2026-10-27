import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeAt, activityMask, HOUR_BLOCKS, maskActiveAt } from './hotspots.ts';

// 70 reports: Mon/Wed/Thu above an even 10 a day, and every report in the afternoon block.
const base = {
  report_count: 70,
  by_dow: [4, 12, 4, 30, 14, 3, 3],
  by_hour: Array.from({ length: 24 }, (_, h) => (h >= 12 && h <= 17 ? 11 : 1)),
};

// The rule the packed mask replaces, straight from the old activeAt().
function activeTheOldWay(h, day, block) {
  if (day !== null && h.by_dow[day] * 7 < h.report_count) return false;
  if (block !== null) {
    const [, from, to] = HOUR_BLOCKS[block];
    const inBlock = h.by_hour.slice(from, to + 1).reduce((a, b) => a + b, 0);
    if (inBlock * 24 < h.report_count * (to - from + 1)) return false;
  }
  return true;
}

test('mask flags the busy days', () => {
  const mask = activityMask(base);
  const busy = [0, 1, 2, 3, 4, 5, 6].filter((d) => maskActiveAt(mask, d, null));
  assert.deepEqual(busy, [1, 3, 4]); // Mon, Wed, Thu
});

test('mask flags the busy hour blocks', () => {
  const mask = activityMask(base);
  const busy = HOUR_BLOCKS.map((_, i) => i).filter((b) => maskActiveAt(mask, null, b));
  assert.deepEqual(busy, [2]); // Afternoon 12-17
});

test('no filter keeps everything', () => {
  assert.equal(maskActiveAt(activityMask(base), null, null), true);
  assert.equal(maskActiveAt(0, null, null), true);
});

test('day and block must both match', () => {
  const mask = activityMask(base);
  assert.equal(maskActiveAt(mask, 3, 2), true); // busy day and busy block
  assert.equal(maskActiveAt(mask, 3, 0), false); // busy day, quiet block
  assert.equal(maskActiveAt(mask, 0, 2), false); // quiet day, busy block
});

test('mask fits in the 11 bits the map payload reserves', () => {
  for (const h of [base, { ...base, by_dow: [10, 10, 10, 10, 10, 10, 10], by_hour: Array(24).fill(3) }]) {
    const mask = activityMask(h);
    assert.ok(Number.isInteger(mask) && mask >= 0 && mask < 1 << 11, `mask out of range: ${mask}`);
  }
});

test('packed mask agrees with the rule it replaced, for every filter combination', () => {
  // A flat hotspot is "busy" everywhere (an even spread ties the >= test), a spiky one is not.
  const cases = [
    base,
    { report_count: 7, by_dow: [1, 1, 1, 1, 1, 1, 1], by_hour: Array(24).fill(0) },
    { report_count: 24, by_dow: [0, 0, 0, 24, 0, 0, 0], by_hour: Array(24).fill(1) },
    { report_count: 0, by_dow: Array(7).fill(0), by_hour: Array(24).fill(0) },
  ];
  for (const h of cases) {
    const mask = activityMask(h);
    for (const day of [null, 0, 1, 2, 3, 4, 5, 6]) {
      for (const block of [null, 0, 1, 2, 3]) {
        assert.equal(
          maskActiveAt(mask, day, block),
          activeTheOldWay(h, day, block),
          `day=${day} block=${block} on ${JSON.stringify(h.by_dow)}`,
        );
      }
    }
  }
});

test('activeAt still answers for a whole hotspot', () => {
  const hotspot = { ...base, by_hour: base.by_hour };
  assert.equal(activeAt(hotspot, 3, 2), true);
  assert.equal(activeAt(hotspot, 0, null), false);
});
