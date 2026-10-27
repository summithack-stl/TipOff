import assert from 'node:assert/strict';
import { test } from 'node:test';
import { npRound, npSum, pyRound } from './refresh/py.ts';
import { dedupe, mercatorToLatLon, parseCityTime, toStreetReport } from './refresh/street-reports.ts';

test('rounding follows numpy (ties to even) and Python round (exact value)', () => {
  assert.equal(npRound(2.5), 2);
  assert.equal(npRound(3.5), 4);
  assert.equal(npRound(0.125, 2), 0.12);
  assert.equal(pyRound(0.125, 2), 0.12); // an exact tie in binary: to even
  assert.equal(pyRound(0.45, 1), 0.5); // 0.45 is stored just above .45
  assert.equal(pyRound(2.675, 2), 2.67); // and 2.675 just below
  assert.equal(pyRound(-1.25, 1), -1.2);
});

test('sums pair up the way numpy does, which a plain loop does not', () => {
  const xs = Array.from({ length: 300 }, (_, i) => 38.6 + i * 1e-5);
  const plain = xs.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(npSum(xs) - plain) < 1e-9);
  assert.equal(npSum([1, 2, 3]), 6);
});

test('the same coordinate self-check as fetch_311.py', () => {
  const [lat, lon] = mercatorToLatLon(-10044192.9857119, 4681102.83016494); // 8417 Lowell St
  assert.ok(Math.abs(lat - 38.7162) < 1e-3 && Math.abs(lon + 90.2285) < 1e-3);
});

const row = (over = {}) => ({
  REQUESTID: ' 2038648 ', PROBLEMCODE: 'Illegal dumpg report ', DATETIMEINIT: '2026-01-01 01:28:07.32',
  DATETIMECLOSED: '2026-01-03 13:28:07.32', STATUS: 'CLOSED', PROBADDRESS: ' 8417 LOWELL ST', NEIGHBORHOOD: '74', WARD: '13',
  SRX: '-10044192.98571190', SRY: '4681102.83016494', DESCRIPTION: 'caller said things', CALLERTYPE: 'WEB', ...over,
});

test('a 311 row keeps place, type and timing, and drops free text and the caller', () => {
  const r = toStreetReport(row());
  assert.deepEqual(Object.keys(r), ['id', 'type', 'code', 'lat', 'lon', 'opened', 'weekday', 'hour', 'address', 'neighborhood', 'ward', 'status', 'days_to_close']);
  assert.equal(r.id, '2038648');
  assert.equal(r.type, 'dumping');
  assert.equal(r.opened, '2026-01-01 01:28');
  assert.equal(r.weekday, 'Thu');
  assert.equal(r.days_to_close, 2.5);
  assert.equal(r.address, '8417 LOWELL ST');
  assert.ok(!JSON.stringify(r).includes('caller'));
});

test('rows outside the three issue types, the city, or without a date are dropped', () => {
  assert.equal(toStreetReport(row({ PROBLEMCODE: 'Public Nuisance Rpt' })), null);
  assert.equal(toStreetReport(row({ SRX: '', SRY: '' })), null); // blank is missing, not 0
  assert.equal(toStreetReport(row({ SRX: '-10200000' })), null); // west of the city
  assert.equal(toStreetReport(row({ DATETIMEINIT: '' })), null);
  assert.equal(toStreetReport(row({ DATETIMECLOSED: '' })).days_to_close, null);
  assert.equal(toStreetReport(row({ WARD: 'NA' })).ward, null); // read_csv's NA strings
  assert.equal(parseCityTime('2026-10-26 07:05'), Date.UTC(2026, 9, 26, 7, 5));
});

test('duplicate request ids keep the first', () => {
  const a = toStreetReport(row());
  const b = { ...a, status: 'OPEN' };
  assert.deepEqual(dedupe([a, b]), [a]);
});

