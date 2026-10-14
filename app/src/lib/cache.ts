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
