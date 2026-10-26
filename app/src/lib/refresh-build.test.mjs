import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backtest, buildHotspots, peakWindow } from './refresh/build.ts';

test('the same self-checks as build_hotspots.py', () => {
  assert.equal(peakWindow([14, 14, 15, 16, 9]), '2pm-5pm');
  assert.equal(peakWindow([23, 0, 1]), '11pm-2am');
});

// Six dumping reports on one block, spread over two years; enough for one hotspot.
const block = (n, start) =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${start + i}`, type: 'dumping', code: 'Illegal dumpg report', lat: 38.7148, lon: -90.2294,
    opened: `2026-0${1 + (i % 9)}-${String(10 + i).padStart(2, '0')} 14:00`, weekday: 'Mon', hour: 14,
    address: i % 3 ? '8440 N BROADWAY' : '', neighborhood: 1, ward: 13, status: 'CLOSED', days_to_close: 1 + i,
  }));

test('a block with five or more reports becomes a ranked, explained hotspot', () => {
  const { hotspots, lite, summary } = buildHotspots([...block(6, 0), ...block(4, 100).map((r) => ({ ...r, lat: 38.6, lon: -90.0001 }))], [['h', 38.7149, -90.2294, 50, 13]], '2026-10-26');
  assert.equal(hotspots.length, 1, 'the 4-report block is not a hotspot');
  const h = hotspots[0];
  assert.equal(h.id, 'dumping-27653_-50128');
  assert.equal(h.rank, 1);
  assert.equal(h.top_address, '8440 N BROADWAY');
  assert.equal(h.vacant_within_150m, 1);
  assert.equal(h.monthly.length, 24);
  assert.ok(h.score >= 0 && h.score <= 100);
  assert.match(h.reasons.at(-1), /^most reports on /);
  assert.deepEqual(lite[0], [h.id, 'dumping', h.lat, h.lon, h.score, h.reports_12m]);
  assert.deepEqual(summary.counts, { dumping: 1 });
  assert.equal(summary.generated, '2026-10-26');
});

test('the backtest refuses to report on nothing', () => {
  assert.throws(() => backtest(block(3, 0), []), /no hotspots before the cutoff/);
});
