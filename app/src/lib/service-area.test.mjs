import assert from 'node:assert/strict';
import { test } from 'node:test';
import { areaForPoint, inServiceArea } from './service-area.ts';

test('accepts the city and Census interior points for Ballwin and Chesterfield', () => {
  assert.equal(areaForPoint(38.627, -90.199), 'stl');
  assert.equal(areaForPoint(38.5947255, -90.5499603), 'ballwin');
  assert.equal(areaForPoint(38.6588695, -90.5794400), 'chesterfield');
  assert.equal(inServiceArea(38.6588695, -90.5794400), true);
});

test('does not admit neighboring towns or invalid coordinates by widening one rectangle', () => {
  assert.equal(inServiceArea(38.58, -90.63), false); // Wildwood
  assert.equal(inServiceArea(38.70, -90.44), false); // Creve Coeur
  assert.equal(inServiceArea(40.7, -74), false);
  assert.equal(inServiceArea(NaN, -90.55), false);
  assert.equal(inServiceArea(38.6, Infinity), false);
});

test('polygon checks exclude points inside municipal bounding rectangles but outside the city', () => {
  assert.equal(inServiceArea(38.560243, -90.585472), false);
  assert.equal(inServiceArea(38.610692, -90.679081), false);
});
