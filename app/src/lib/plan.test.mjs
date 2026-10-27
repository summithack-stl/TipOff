import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planFacts } from './plan.ts';

const h = {
  id: 'dumping-27593_-50111', category: 'dumping', lat: 38.6612, lon: -90.2011, ward: 14, score: 91, rank: 1,
  report_count: 40, trend: 1.44, peak_day: 'Mon', peak_hour: 14,
  by_dow: [2, 12, 6, 5, 6, 5, 4], by_hour: Array(24).fill(0), monthly: [],
  reports_12m: 22, reports_prev_12m: 9, active_weeks_12m: 15,
  report_window: '2pm-5pm', median_days_to_close: 6.5,
  top_address: '2700 N GRAND BLVD', vacant_within_150m: 4, nearest_vacant_m: 35,
  recent: [{ opened: '2026-10-01', code: 'Illegal dumpg report', address: '2700 N GRAND BLVD' }],
  reasons: ['22 reports in the last 12 months'],
};

test('planFacts labels report times as report times, not dumping times', () => {
  const f = planFacts(h, []);
  assert.equal(f.reports_mostly_come_in, '2pm-5pm');
  assert.equal(f.most_reports_on, 'Mon');
  assert.ok(!('dumping_time' in f));
});

test('planFacts passes photo findings through and states the rank', () => {
  const f = planFacts(h, [{ category: 'dumping', severity: 'high', note: 'mattresses and tires' }]);
  assert.deepEqual(f.photo_findings, [{ category: 'dumping', severity: 'high', note: 'mattresses and tires' }]);
  assert.equal(f.priority, '91/100 (#1 of dumping hotspots)');
});

test('photo-only plans do not turn missing annual history into zero reports or a ranked claim', () => {
  const f = planFacts({ ...h, source: 'field', rank: 0, field_reports: 5, report_count: 5 }, []);
  assert.equal(f.reports_on_block, 5);
  assert.equal(f.annual_311_history, 'Not available for this photo-report hotspot');
  assert.ok(!('reports_year_before' in f));
  assert.ok(!('vacant_buildings_within_150m' in f));
  assert.ok(!('reports_mostly_come_in' in f));
  assert.match(f.priority, /provisional/);
  assert.equal(f.evidence_source, 'TipOff photo reports; reporters are not verified residents');
});
