import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LABELLED_CODES, reportLabel } from './report-codes.ts';

test('every code is written out in plain words', () => {
  assert.equal(reportLabel('Illegal dumpg report'), 'Illegal dumping');
  assert.equal(reportLabel('Debris-Vacant Bldg'), 'Debris at a vacant building');
  assert.equal(reportLabel('Potholes - Residnl'), 'Pothole on a residential street');
  assert.equal(reportLabel('Graffiti-Prvt Dmpstr'), 'Graffiti on a private dumpster');
});

test('surrounding whitespace does not hide a code', () => {
  assert.equal(reportLabel('  Illegal dumpg report '), 'Illegal dumping');
});

test('an unknown code comes back as the City wrote it, not as a guess', () => {
  assert.equal(reportLabel('Some New Code 2027'), 'Some New Code 2027');
  assert.equal(reportLabel(''), '');
});

test('the labels cover exactly the codes the 311 extract keeps', () => {
  // data/scripts/fetch_311.py decides which problem codes become hotspots. If someone adds one
  // there and not here, a crew sees the raw abbreviation again — so this test reads that file.
  const py = readFileSync(new URL('../../../data/scripts/fetch_311.py', import.meta.url), 'utf8');
  const block = /CODES = \{([\s\S]*?)\}/.exec(py);
  assert.ok(block, 'could not find CODES in fetch_311.py');
  const codes = [...block[1].matchAll(/"([^"]+)":/g)].map((m) => m[1]);
  assert.ok(codes.length >= 13, `expected the 311 code list, got ${codes.length}`);
  assert.deepEqual([...codes].sort(), [...LABELLED_CODES].sort());
});
