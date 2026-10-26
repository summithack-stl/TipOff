import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cellOf, fieldHotspots, inStLouis } from './field-reports.ts';

const at = (lat, lon, when = '2026-10-26T14:00:00Z') => ({ id: `r-${lat}-${lon}-${when}`, lat, lon, at: when, confidence: 0.9, note: 'mattress and bags', photo: null });

test('cells match the Python grid, including negative longitudes', () => {
  // build_hotspots.py: lat // 0.0014, lon // 0.0018 (floor division)
  assert.equal(cellOf(38.7148, -90.2294), '27653_-50128');
  assert.equal(cellOf(38.6, -90.0001), '27571_-50001');
});

test('only St. Louis locations are accepted', () => {
  assert.equal(inStLouis(38.627, -90.199), true);
  assert.equal(inStLouis(38.59, -90.52), false); // Ballwin
  assert.equal(inStLouis(40.7, -74.0), false);
});

test('a report on an existing hotspot adds a photo count and a reason', () => {
  const known = { id: 'dumping-27653_-50128', reasons: ['9 reports in the last 12 months'] };
  const out = fieldHotspots([at(38.7148, -90.2294), at(38.7149, -90.2293)], new Map([[known.id, known]]), new Map());
  assert.equal(out.length, 1);
  assert.equal(out[0].field_reports, 2);
  assert.equal(out[0].reasons[0], '2 photo reports from the TipOff app');
  assert.equal(out[0].reasons[1], '9 reports in the last 12 months');
});

test('a block becomes a new hotspot only once 311 plus photo reports reach 5', () => {
  const cell = cellOf(38.62, -90.21);
  const four311 = new Map([[cell, { count: 4, address: '2830 59TH ST', ward: 10 }]]);
  assert.equal(fieldHotspots([], new Map(), four311).length, 0);
  const out = fieldHotspots([at(38.62, -90.21)], new Map(), four311);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, `dumping-${cell}`);
  assert.equal(out[0].source, 'field');
  assert.equal(out[0].report_count, 5);
  assert.equal(out[0].top_address, '2830 59TH ST');
  assert.equal(out[0].ward, 10);
  // 3 city reports + 1 photo is still under the bar
  assert.equal(fieldHotspots([at(38.62, -90.21)], new Map(), new Map([[cell, { count: 3, address: null, ward: null }]])).length, 0);
});
