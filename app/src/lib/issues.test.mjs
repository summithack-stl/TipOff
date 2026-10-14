import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignIds, capPerCategory, CATEGORIES, DEPARTMENT, distanceMeters, dropOverlaps, findDuplicate, needsConfirm, toBox, visionResultSchema } from './issues.ts';

test('toBox converts Gemini box_2d (ymin,xmin,ymax,xmax 0-1000) to 0-1 x/y/w/h', () => {
  assert.deepEqual(toBox([100, 200, 500, 600]), { x: 0.2, y: 0.1, w: 0.4, h: 0.4 });
});

test('toBox fixes swapped corners and clamps to the frame', () => {
  assert.deepEqual(toBox([500, 600, 100, -50]), { x: 0, y: 0.1, w: 0.6, h: 0.4 });
});

test('needsConfirm: low confidence or high severity goes to the second model', () => {
  assert.equal(needsConfirm({ confidence: 0.6, severity: 'low' }), true);
  assert.equal(needsConfirm({ confidence: 0.95, severity: 'high' }), true);
  assert.equal(needsConfirm({ confidence: 0.95, severity: 'low' }), false);
});

test('distanceMeters is about 111 m per 0.001 deg latitude', () => {
  const d = distanceMeters({ lat: 38.627, lon: -90.199 }, { lat: 38.628, lon: -90.199 });
  assert.ok(Math.abs(d - 111) < 1, `got ${d}`);
});

test('findDuplicate matches an open ticket of the same category within 30 m', () => {
  const tickets = [
    { id: 'far', category: 'pothole', status: 'open', lat: 38.63, lon: -90.199 },
    { id: 'other-kind', category: 'graffiti', status: 'open', lat: 38.627, lon: -90.199 },
    { id: 'closed', category: 'pothole', status: 'verified', lat: 38.627, lon: -90.199 },
    { id: 'match', category: 'pothole', status: 'in_progress', lat: 38.6271, lon: -90.199 },
  ];
  assert.equal(findDuplicate(tickets, { category: 'pothole', lat: 38.627, lon: -90.199 })?.id, 'match');
  assert.equal(findDuplicate(tickets, { category: 'dumping', lat: 38.627, lon: -90.199 }), undefined);
});

test('assignIds keeps an id when the same category overlaps the previous keyframe', () => {
  const prev = [{ id: 'd_001', category: 'pothole', box: { x: 0.4, y: 0.6, w: 0.2, h: 0.1 } }];
  const next = [
    { category: 'pothole', box: { x: 0.42, y: 0.58, w: 0.2, h: 0.1 } },
    { category: 'graffiti', box: { x: 0.0, y: 0.0, w: 0.3, h: 0.3 } },
  ];
  const counter = { n: 1 };
  const out = assignIds(prev, next, counter);
  assert.equal(out[0].id, 'd_001');
  assert.equal(out[1].id, 'd_002');
  assert.equal(counter.n, 2);
});

test('assignIds gives a new id when boxes do not overlap', () => {
  const prev = [{ id: 'd_001', category: 'pothole', box: { x: 0.0, y: 0.0, w: 0.1, h: 0.1 } }];
  const out = assignIds(prev, [{ category: 'pothole', box: { x: 0.8, y: 0.8, w: 0.1, h: 0.1 } }], { n: 1 });
  assert.equal(out[0].id, 'd_002');
});

test('dropOverlaps removes a near-identical box of the same category, keeps the more confident', () => {
  const box = { x: 0, y: 0.3, w: 1, h: 0.7 };
  const out = dropOverlaps([
    { category: 'dumping', confidence: 0.9, box },
    { category: 'dumping', confidence: 0.96, box },
    { category: 'graffiti', confidence: 0.8, box },
  ]);
  assert.deepEqual(out.map((d) => [d.category, d.confidence]), [['dumping', 0.96], ['graffiti', 0.8]]);
});

test('capPerCategory keeps the most confident few per category', () => {
  const box = { x: 0, y: 0, w: 0.1, h: 0.1 };
  const many = [0.5, 0.9, 0.7, 0.8, 0.6, 0.95].map((confidence) => ({ category: 'open_entry', confidence, box }));
  const out = capPerCategory([...many, { category: 'graffiti', confidence: 0.4, box }], 4);
  assert.deepEqual(out.filter((d) => d.category === 'open_entry').map((d) => d.confidence), [0.95, 0.9, 0.8, 0.7]);
  assert.equal(out.filter((d) => d.category === 'graffiti').length, 1);
});

test('vision schema accepts the curb and sidewalk categories and every category has a department', () => {
  for (const category of ['broken_curb', 'sidewalk_damage']) {
    const parsed = visionResultSchema.parse({ detections: [{ category, box_2d: [0, 0, 10, 10], confidence: 0.9 }] });
    assert.equal(parsed.detections[0].category, category);
  }
  for (const c of CATEGORIES) assert.ok(DEPARTMENT[c], `no department for ${c}`);
});

test('vision schema drops malformed detections instead of failing the whole frame', () => {
  const parsed = visionResultSchema.parse({
    detections: [
      { category: 'potholes', box_2d: [0, 0, 10, 10], confidence: 0.9 },
      { category: 'pothole', box_2d: [[0, 0, 10, 10]], confidence: 0.9 },
      { category: 'pothole', box_2d: [100, 200, 300, 400], confidence: 0.8 },
    ],
  });
  assert.equal(parsed.detections.length, 1);
  assert.deepEqual(parsed.detections[0].box_2d, [100, 200, 300, 400]);
});
