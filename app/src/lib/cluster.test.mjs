import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CELL_PX, clusterHotspots, MAX_CLUSTER_ZOOM, project } from './cluster.ts';

// [id, category, lat, lon, ward, score, report_count, activity]
const at = (id, lat, lon, score = 50) => [id, 'dumping', lat, lon, 1, score, 10, 0];

test('projection matches Web Mercator, so a cell really is CELL_PX on screen', () => {
  // At zoom 0 the whole world is one 256 px tile: longitude 0 sits at x = 128.
  const [x, y] = project(0, 0, 0);
  assert.equal(Math.round(x), 128);
  assert.equal(Math.round(y), 128);
  // Each zoom level doubles the pixel scale.
  const [x1] = project(0, 180, 1);
  assert.equal(Math.round(x1), 512);
  // St. Louis is north of the equator and west of Greenwich.
  const [sx, sy] = project(38.627, -90.199, 12);
  assert.ok(sx > 0 && sx < 256 * 2 ** 12);
  assert.ok(sy > 0 && sy < 256 * 2 ** 12 / 2, 'northern hemisphere is in the top half');
});

test('a wild latitude cannot produce Infinity and take the layer with it', () => {
  for (const lat of [90, -90, 1e9]) {
    const [, y] = project(lat, 0, 12);
    assert.ok(Number.isFinite(y), `lat ${lat} produced ${y}`);
  }
});

test('above the threshold every hotspot is its own marker, however close together', () => {
  const touching = [at('a', 38.60000, -90.20000), at('b', 38.60001, -90.20001)];
  assert.equal(clusterHotspots(touching, MAX_CLUSTER_ZOOM).length, 1, 'clustered at the threshold');
  assert.equal(clusterHotspots(touching, MAX_CLUSTER_ZOOM + 1).length, 2, 'not clustered above it');
});

test('hotspots far apart stay separate markers', () => {
  const clusters = clusterHotspots([at('a', 38.60, -90.30), at('b', 38.70, -90.10)], 12);
  assert.equal(clusters.length, 2);
  assert.ok(clusters.every((c) => c.items.length === 1));
});

test('hotspots in the same cell become one cluster at its centre', () => {
  const clusters = clusterHotspots([at('a', 38.6000, -90.2000), at('b', 38.6001, -90.2001)], 10);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].items.length, 2);
  assert.ok(Math.abs(clusters[0].lat - 38.60005) < 1e-6, 'centre is the mean latitude');
  assert.ok(Math.abs(clusters[0].lon - -90.20005) < 1e-6, 'centre is the mean longitude');
});

test('a cluster is as urgent as its worst block', () => {
  const [cluster] = clusterHotspots([at('a', 38.6, -90.2, 31), at('b', 38.6001, -90.2001, 88)], 10);
  assert.equal(cluster.items.length, 2);
  assert.equal(cluster.score, 88);
});

test('zooming in breaks a cluster apart', () => {
  const pair = [at('a', 38.6000, -90.2000), at('b', 38.6020, -90.2020)];
  assert.equal(clusterHotspots(pair, 11).length, 1, 'one cluster when zoomed out');
  assert.equal(clusterHotspots(pair, 16).length, 2, 'two markers when zoomed in');
});

test('every hotspot comes out exactly once, at every zoom', () => {
  const many = Array.from({ length: 400 }, (_, i) =>
    at(`h${i}`, 38.55 + (i % 20) * 0.01, -90.30 + Math.floor(i / 20) * 0.01, i % 100),
  );
  for (const zoom of [9, 11, 12, 14, 16, 18]) {
    const clusters = clusterHotspots(many, zoom);
    const ids = clusters.flatMap((c) => c.items.map((h) => h[0]));
    assert.equal(ids.length, many.length, `zoom ${zoom} lost or duplicated hotspots`);
    assert.equal(new Set(ids).size, many.length, `zoom ${zoom} produced a duplicate`);
  }
});

test('clustering actually thins the map at city zoom', () => {
  // 400 hotspots over a few blocks: the case that made /map a wall of overlapping circles.
  const dense = Array.from({ length: 400 }, (_, i) =>
    at(`h${i}`, 38.60 + (i % 20) * 0.001, -90.20 + Math.floor(i / 20) * 0.001),
  );
  const drawn = clusterHotspots(dense, 12).length;
  assert.ok(drawn < dense.length / 4, `expected far fewer markers, drew ${drawn}`);
  assert.equal(clusterHotspots(dense, 19).length, dense.length, 'and none at full zoom');
});

test('weakest first, so the worst cluster paints on top', () => {
  const clusters = clusterHotspots([at('a', 38.60, -90.30, 90), at('b', 38.70, -90.10, 20)], 14);
  assert.deepEqual(clusters.map((c) => c.score), [20, 90]);
});

test('no hotspots, no clusters', () => {
  assert.deepEqual(clusterHotspots([], 12), []);
});

test('the default cell is the size the map markers need', () => {
  assert.equal(CELL_PX, 56);
});

test('clusters stay a low-zoom thing, so the DOM marker count stays bounded', () => {
  // Cluster markers are DOM nodes, where a plain hotspot is drawn on the shared canvas, so the
  // thing worth asserting is that clustering always draws far fewer of them than there are
  // hotspots, and none at all once a crew has zoomed in. Against the real 2,950 hotspots zoom 13
  // draws 219; this grid is more evenly packed than the city, so it draws more.
  const city = Array.from({ length: 2950 }, (_, i) =>
    at(`h${i}`, 38.54 + (i % 59) * 0.004, -90.32 + Math.floor(i / 59) * 0.003, i % 100),
  );
  for (let zoom = 9; zoom <= MAX_CLUSTER_ZOOM; zoom++) {
    const drawn = clusterHotspots(city, zoom);
    const dom = drawn.filter((c) => c.items.length > 1).length;
    assert.ok(dom < city.length / 4, `zoom ${zoom} would draw ${dom} cluster markers of ${city.length}`);
    assert.ok(drawn.length < city.length, `zoom ${zoom} drew ${drawn.length}, no better than no clustering`);
  }
  for (const zoom of [14, 16, 18]) {
    assert.equal(clusterHotspots(city, zoom).filter((c) => c.items.length > 1).length, 0);
    assert.equal(clusterHotspots(city, zoom).length, city.length);
  }
});

test('the clustering threshold is the one the component builds against', () => {
  // radar-map.tsx renders a DOM marker per cluster; see the note on MAX_CLUSTER_ZOOM before
  // raising this, because the marker count peaks in the middle of the zoom range, not at the end.
  assert.equal(MAX_CLUSTER_ZOOM, 13);
});
