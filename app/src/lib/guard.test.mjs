import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clientKey, DAILY_LIMITS, dailyQuota, hit, quotaStatus, upstreamError } from './guard.ts';

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

test('upstreamError tells the operator when an AI key is missing, without leaking anything else', async () => {
  const quiet = console.error;
  console.error = () => {};
  const missing = upstreamError('plan', new Error('LLM_API_KEY is not set'));
  const other = upstreamError('plan', new Error('socket hang up secret-detail'));
  console.error = quiet;
  assert.equal(missing.status, 503);
  assert.match((await missing.json()).error, /LLM_API_KEY/);
  assert.equal(other.status, 502);
  assert.doesNotMatch((await other.json()).error, /secret-detail/);
});

test('a refused call charges neither the client budget nor the shared one', async () => {
  // DAILY_LIMITS.frames.anon is 5. The sixth call must be refused without spending the org budget,
  // or one phone that is already over its own allowance would burn the whole team's.
  const req = () => new Request('http://x', { headers: { 'x-forwarded-for': '9.9.9.9' } });
  for (let i = 0; i < DAILY_LIMITS.frames.anon; i++) {
    assert.equal(dailyQuota(req(), 'frames'), null, `call ${i + 1} should be allowed`);
  }
  const spentBefore = DAILY_LIMITS.frames.org - quotaStatus().frames.remaining;

  for (let i = 0; i < 20; i++) {
    const refusal = dailyQuota(req(), 'frames');
    assert.equal(refusal?.status, 429, 'over the client allowance');
  }
  assert.equal(
    DAILY_LIMITS.frames.org - quotaStatus().frames.remaining,
    spentBefore,
    'refused calls must not touch the shared budget',
  );

  // Another phone is unaffected and still gets its own allowance.
  const other = new Request('http://x', { headers: { 'x-forwarded-for': '8.8.8.8' } });
  assert.equal(dailyQuota(other, 'frames'), null);
});
