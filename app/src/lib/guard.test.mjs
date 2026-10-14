import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clientKey, hit } from './guard.ts';

test('hit allows up to the limit per window, then reports seconds to wait', () => {
  const hits = new Map();
  for (let i = 0; i < 3; i++) assert.equal(hit(hits, 'a', 3, 60_000, 1_000), 0);
  assert.equal(hit(hits, 'a', 3, 60_000, 1_000), 60);
  assert.equal(hit(hits, 'b', 3, 60_000, 1_000), 0, 'other clients are not affected');
  assert.equal(hit(hits, 'a', 3, 60_000, 61_001), 0, 'a new window starts fresh');
});

test('clientKey uses the first x-forwarded-for address', () => {
  const req = new Request('http://x', { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } });
  assert.equal(clientKey(req), '1.2.3.4');
  assert.equal(clientKey(new Request('http://x')), 'unknown');
});
