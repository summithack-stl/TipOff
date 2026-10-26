import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function cached<T>(key: unknown, fn: () => Promise<T>): Promise<T> {
  if (process.env.DEMO_CACHE !== '1') return fn();

  const hash = createHash('sha256').update(JSON.stringify(key)).digest('hex');
  const directory = join(process.cwd(), '.demo-cache');
  const file = join(directory, `${hash}.json`);

  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const result = await fn();
  // Best effort: Vercel's file system is read-only, and a failed save must not fail the request.
  await mkdir(directory, { recursive: true })
    .then(() => writeFile(file, JSON.stringify(result)))
    .catch((error: unknown) => console.warn('demo cache not saved:', (error as Error).message));
  return result;
}

// --- Shared in-flight results -------------------------------------------------------------------
//
// Ten crew members opening the same block should cost one LLM call, not ten. This caches the
// PROMISE, not just the result, so calls that arrive while the first is still running join it
// instead of starting their own.

export type Shared<T> = { at: number; value: Promise<T> };

/** Oldest entries go first once the map is this big. Plans are small; this is about not leaking. */
const MAX_ENTRIES = 500;

/** The live entry for a key, if there is one. Lets a caller tell a hit from a miss before paying. */
export function sharedHit<T>(store: Map<string, Shared<T>>, key: string, ttlMs: number): Promise<T> | undefined {
  const hit = store.get(key);
  return hit && Date.now() - hit.at < ttlMs ? hit.value : undefined;
}

export function shared<T>(store: Map<string, Shared<T>>, key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = sharedHit(store, key, ttlMs);
  if (hit) return hit;

  const value = fn();
  store.set(key, { at: Date.now(), value });
  // A failure is never kept: one upstream blip must not poison this block for everyone until the
  // TTL runs out. Only drop our own entry, in case a later call has already replaced it.
  void value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key);
  });

  if (store.size > MAX_ENTRIES) {
    for (const k of [...store.keys()].slice(0, store.size - MAX_ENTRIES)) store.delete(k);
  }
  return value;
}
