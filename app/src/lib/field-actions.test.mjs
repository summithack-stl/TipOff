import assert from 'node:assert/strict';
import { test } from 'node:test';
import { directionsUrl, hotspotLink } from './field-actions.ts';

// shareHotspot branches on navigator.share / navigator.clipboard, so it is exercised in the
// Playwright run rather than stubbed into existence here. directionsUrl takes the platform as an
// argument precisely so it can be checked both ways without a browser.

test('a shared link opens that hotspot on the map', () => {
  assert.equal(
    hotspotLink('dumping-27654_-50128', 'https://summithack-blond.vercel.app'),
    'https://summithack-blond.vercel.app/map?h=dumping-27654_-50128',
  );
});

test('the id is encoded, so a hotspot id can never break out of the query string', () => {
  assert.equal(hotspotLink('a&b=c', 'https://x.test'), 'https://x.test/map?h=a%26b%3Dc');
  assert.equal(hotspotLink('a b', 'https://x.test'), 'https://x.test/map?h=a%20b');
});

test('a hotspot id survives the round trip through the link', () => {
  for (const id of ['dumping-27654_-50128', 'pothole-27616_-50164', 'graffiti-27572_-50135']) {
    const url = new URL(hotspotLink(id, 'https://x.test'));
    assert.equal(url.pathname, '/map');
    assert.equal(url.searchParams.get('h'), id);
  }
});

test('iOS gets an Apple Maps link, everything else Google Maps', () => {
  const ios = directionsUrl(38.71634, -90.22919, true, '8440 N BROADWAY');
  assert.match(ios, /^https:\/\/maps\.apple\.com\//);
  assert.match(ios, /daddr=38\.716340,-90\.229190/);

  const other = directionsUrl(38.71634, -90.22919, false, '8440 N BROADWAY');
  assert.match(other, /^https:\/\/www\.google\.com\/maps\/dir\//);
  assert.match(other, /destination=38\.716340,-90\.229190/);
});

test('both links are https, so a desktop or a phone with no maps app still has somewhere to go', () => {
  for (const ios of [true, false]) {
    assert.equal(new URL(directionsUrl(38.6, -90.2, ios)).protocol, 'https:');
  }
});

test('an address with spaces or an ampersand cannot break the link', () => {
  const url = new URL(directionsUrl(38.6, -90.2, true, 'N BROADWAY & E GRAND'));
  assert.equal(url.searchParams.get('q'), 'N BROADWAY & E GRAND');
});

test('a negative longitude keeps its sign through the rounding', () => {
  assert.match(directionsUrl(-38.5, -90.2, false), /destination=-38\.500000,-90\.200000/);
});
