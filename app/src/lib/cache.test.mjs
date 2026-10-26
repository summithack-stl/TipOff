import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { cached, shared } from './cache.ts';

async function inTempDirectory(enabled, run) {
  const directory = await mkdtemp(join(tmpdir(), 'summithack-cache-'));
  const previousDirectory = process.cwd();
  const previousSetting = process.env.DEMO_CACHE;
  try {
    process.chdir(directory);
    process.env.DEMO_CACHE = enabled;
    await run();
  } finally {
    process.chdir(previousDirectory);
    if (previousSetting === undefined) delete process.env.DEMO_CACHE;
    else process.env.DEMO_CACHE = previousSetting;
    await rm(directory, { recursive: true, force: true });
  }
}

test('DEMO_CACHE=1 reuses the first result', async () => {
  await inTempDirectory('1', async () => {
    let calls = 0;
    const produce = async () => ({ value: ++calls });
    assert.deepEqual(await cached({ prompt: 'hello' }, produce), { value: 1 });
    assert.deepEqual(await cached({ prompt: 'hello' }, produce), { value: 1 });
    assert.equal(calls, 1);
  });
});

test('DEMO_CACHE=0 calls the producer every time', async () => {
  await inTempDirectory('0', async () => {
    let calls = 0;
    const produce = async () => ++calls;
    assert.equal(await cached('hello', produce), 1);
    assert.equal(await cached('hello', produce), 2);
    assert.equal(calls, 2);
  });
});

test('shared() turns ten people opening the same plan into one call', async () => {
  const store = new Map();
  let calls = 0;
  const slow = () => new Promise((resolve) => { calls++; setTimeout(() => resolve('plan'), 20); });

  // All ten arrive while the first is still in flight.
  const results = await Promise.all(Array.from({ length: 10 }, () => shared(store, 'k', 60_000, slow)));
  assert.equal(calls, 1, 'should have made one call');
  assert.deepEqual(results, Array(10).fill('plan'));

  // And one arriving afterwards is served from the cache.
  assert.equal(await shared(store, 'k', 60_000, slow), 'plan');
  assert.equal(calls, 1);
});

test('shared() keys apart, so two blocks do not share a plan', async () => {
  const store = new Map();
  let calls = 0;
  const fn = (v) => () => { calls++; return Promise.resolve(v); };
  assert.equal(await shared(store, 'a', 60_000, fn('A')), 'A');
  assert.equal(await shared(store, 'b', 60_000, fn('B')), 'B');
  assert.equal(calls, 2);
});

test('shared() expires, so a rebuilt hotspot gets a fresh plan', async () => {
  const store = new Map();
  let calls = 0;
  const fn = () => { calls++; return Promise.resolve('v' + calls); };
  assert.equal(await shared(store, 'k', 1, fn), 'v1');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(await shared(store, 'k', 1, fn), 'v2');
});

test('shared() never caches a failure', async () => {
  const store = new Map();
  let calls = 0;
  const flaky = () => { calls++; return calls === 1 ? Promise.reject(new Error('busy')) : Promise.resolve('ok'); };
  await assert.rejects(shared(store, 'k', 60_000, flaky), /busy/);
  // The next caller gets a real attempt rather than the cached failure.
  assert.equal(await shared(store, 'k', 60_000, flaky), 'ok');
  assert.equal(calls, 2);
});

test('shared() keeps its memory bounded', async () => {
  const store = new Map();
  for (let i = 0; i < 600; i++) await shared(store, `k${i}`, 60_000, () => Promise.resolve(i));
  assert.ok(store.size <= 500, `store grew to ${store.size}`);
});
