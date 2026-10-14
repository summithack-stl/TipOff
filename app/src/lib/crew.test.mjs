import assert from 'node:assert/strict';
import { test } from 'node:test';
import { busyDays, cityToday, parseWindow, todaysHotspots, watchWindow, whatsThere } from './crew.ts';

const base = {
  id: 'dumping-1_-1', category: 'dumping', lat: 38.6, lon: -90.2, ward: 13, score: 78, rank: 1,
  report_count: 50, trend: 1.6, peak_day: 'Wed', peak_hour: 5,
  by_dow: [4, 9, 4, 14, 10, 6, 3], by_hour: Array(24).fill(0), monthly: [],
  reports_12m: 26, reports_prev_12m: 10, active_weeks_12m: 14,
  report_window: '8am-11am', median_days_to_close: 4,
  top_address: '8440 N BROADWAY', vacant_within_150m: 13, nearest_vacant_m: 14,
  recent: [{ opened: '2026-10-14', code: 'Debris-alley/street', address: '8444 N BROADWAY' }],
  reasons: [],
};

test('city day uses St. Louis time', () => {
  // 03:00 UTC Thursday is still Wednesday evening in St. Louis.
  assert.equal(cityToday(new Date('2026-10-15T03:00:00Z')), 'Wed');
});

test('report window parses, including noon and midnight', () => {
  assert.deepEqual(parseWindow('8am-11am'), [8, 11]);
  assert.deepEqual(parseWindow('12pm-3pm'), [12, 15]);
  assert.deepEqual(parseWindow('9pm-12am'), [21, 0]);
  assert.equal(parseWindow('soon'), null);
});

test('watch window is the 12 hours before reports start', () => {
  assert.equal(watchWindow(base), '8pm–8am');
  assert.equal(watchWindow({ ...base, report_window: '2pm-5pm' }), '2am–2pm');
  assert.equal(watchWindow({ ...base, report_window: '12am-3am' }), '12pm–12am');
});

test('busy days are above an even spread', () => {
  // 50 reports / 7 days ≈ 7.1 a day: Mon 9, Wed 14, Thu 10 are busy.
  assert.deepEqual(busyDays(base), ['Mon', 'Wed', 'Thu']);
});

test('what is there prefers photo findings and adds 311 and vacant context', () => {
  const lines = whatsThere(base, [{ category: 'dumping', severity: 'high', note: 'mattress and bags in alley' }]);
  assert.equal(lines[0], 'Street photo: mattress and bags in alley (severe)');
  assert.equal(lines[1], 'Latest 311: Debris-alley/street, 2026-10-14');
  assert.equal(lines[2], '13 vacant buildings within 150 m');
  assert.equal(whatsThere(base, [])[0], 'Street photo on file, nothing flagged in it');
  assert.equal(whatsThere(base, undefined)[0], 'Latest 311: Debris-alley/street, 2026-10-14');
});

test('today keeps only hotspots busy today, strongest first, capped per category', () => {
  const quiet = { ...base, id: 'dumping-2_-2', score: 99, by_dow: [14, 4, 4, 4, 9, 9, 6] };
  const weaker = { ...base, id: 'dumping-3_-3', score: 40 };
  const list = todaysHotspots([weaker, quiet, base], 'Wed', 1);
  assert.deepEqual(list.map((h) => h.id), ['dumping-1_-1']);
});
