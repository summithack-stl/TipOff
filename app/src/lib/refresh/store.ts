import "server-only";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BlobPreconditionFailedError, del, get, list, put } from "@vercel/blob";
import { EMPTY_STATUS, type Counts, type RefreshStatus } from "./status.ts";

// Where refreshed data lives: outside git. On Vercel, Blob storage (the same store photo reports
// use, under refresh/); locally without a token, app/.data/refresh. Each run writes its own folder,
// then latest.json points at it, so readers never see a half-written run.
const BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL = join(process.cwd(), ".data/refresh");
const STATUS = "refresh/status.json";
const LATEST = "refresh/latest.json";
const KEEP_RUNS = 3;

export const storeConfigured = () => BLOB || !process.env.VERCEL;

/** What readers follow: the newest run that passed its checks. */
export type Latest = { runId: string; at: string; generated: string; windowEnd: string; counts: Counts; files: Record<string, string> };

export class StatusConflict extends Error {}

async function readText(pathname: string): Promise<{ text: string; etag: string } | null> {
  if (BLOB) {
    const got = await get(pathname, { access: "public" });
    if (!got || got.statusCode !== 200) return null;
    return { text: await new Response(got.stream).text(), etag: got.blob.etag };
  }
  try {
    return { text: await readFile(join(LOCAL, pathname), "utf8"), etag: "local" };
  } catch {
    return null;
  }
}

async function writeText(pathname: string, text: string, opts: { ifMatch?: string; maxAge?: number } = {}): Promise<string> {
  if (BLOB) {
    const res = await put(pathname, text, {
      access: "public", contentType: "application/json", addRandomSuffix: false,
      // Pointers change daily and must not sit in the CDN for the default month; run files never change.
      cacheControlMaxAge: opts.maxAge ?? 60 * 60 * 24 * 30,
      ...(opts.ifMatch ? { ifMatch: opts.ifMatch } : { allowOverwrite: true }),
    });
    return res.url;
  }
  const file = join(LOCAL, pathname);
  await mkdir(join(file, ".."), { recursive: true });
  await writeFile(file, text);
  return file;
}

export async function readStatus(): Promise<{ status: RefreshStatus; etag: string | null }> {
  const got = await readText(STATUS);
  return got ? { status: { ...EMPTY_STATUS, ...(JSON.parse(got.text) as RefreshStatus) }, etag: got.etag } : { status: EMPTY_STATUS, etag: null };
}

/** Writes the status only if nobody else has since `etag`: that is what stops two refreshes at once. */
export async function writeStatus(status: RefreshStatus, etag: string | null): Promise<void> {
  try {
    await writeText(STATUS, JSON.stringify(status), { ifMatch: etag && etag !== "local" ? etag : undefined, maxAge: 60 });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) throw new StatusConflict("Another refresh changed the status first.");
    throw error;
  }
}

export async function readLatest(): Promise<Latest | null> {
  const got = await readText(LATEST);
  return got ? (JSON.parse(got.text) as Latest) : null;
}

/** One run's files, then the pointer to them. Old runs past the last few are removed. */
export async function publish(runId: string, files: Record<string, string>, facts: Omit<Latest, "runId" | "files">): Promise<Latest> {
  const urls: Record<string, string> = {};
  for (const [name, text] of Object.entries(files)) urls[name] = await writeText(`refresh/runs/${runId}/${name}`, text);
  const latest: Latest = { runId, files: urls, ...facts };
  await writeText(LATEST, JSON.stringify(latest), { maxAge: 60 });
  await prune(runId).catch(() => {}); // storage tidying is never worth failing a good refresh over
  return latest;
}

async function prune(current: string) {
  if (BLOB) {
    const { folders } = await list({ prefix: "refresh/runs/", mode: "folded" });
    const old = folders.sort().reverse().slice(KEEP_RUNS).filter((f) => !f.includes(current));
    for (const folder of old) {
      const { blobs } = await list({ prefix: folder });
      if (blobs.length) await del(blobs.map((b) => b.url));
    }
    return;
  }
  const runs = (await readdir(join(LOCAL, "refresh/runs"))).sort().reverse();
  for (const r of runs.slice(KEEP_RUNS)) if (r !== current) await rm(join(LOCAL, "refresh/runs", r), { recursive: true });
}

/** A published file's text: a Blob URL, or a local path in development. */
export async function readPublished(url: string): Promise<string> {
  if (!BLOB) return readFile(url, "utf8");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`refresh data: ${url} answered ${res.status}`);
  return res.text();
}
