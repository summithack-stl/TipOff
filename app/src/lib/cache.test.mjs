import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { cached } from './cache.ts';

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
