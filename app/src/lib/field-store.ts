import "server-only";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { list, put } from "@vercel/blob";
import { cellOf, fieldHotspots, type CellInfo, type FieldReport } from "./field-reports.ts";
import type { Hotspot } from "@/lib/hotspots";
import { hotspotData, streetReportsText } from "@/lib/hotspot-store";

// Where photo reports live. On Vercel: Blob storage (BLOB_READ_WRITE_TOKEN is added when a Blob store is
// connected to the project). Locally without a token: app/.data/reports, so the feature works on a fresh clone.
const BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL = join(process.cwd(), ".data/reports");
const PREFIX = "reports/";

export const storeConfigured = () => BLOB || !process.env.VERCEL;

export async function saveReport(report: FieldReport, photo: { bytes: ArrayBuffer; type: string } | null): Promise<FieldReport> {
  if (BLOB) {
    let url: string | null = null;
    if (photo) {
      const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
      url = (await put(`${PREFIX}${report.id}.${ext}`, Buffer.from(photo.bytes), { access: "public", contentType: photo.type, addRandomSuffix: false })).url;
    }
    const saved = { ...report, photo: url };
    await put(`${PREFIX}${report.id}.json`, JSON.stringify(saved), { access: "public", contentType: "application/json", addRandomSuffix: false });
    cache = null;
    return saved;
  }
  await mkdir(LOCAL, { recursive: true });
  let url: string | null = null;
  if (photo) {
    await writeFile(join(LOCAL, `${report.id}.jpg`), Buffer.from(photo.bytes));
    url = null; // ponytail: local photos aren't served; Blob storage serves them in production.
  }
  const saved = { ...report, photo: url };
  await writeFile(join(LOCAL, `${report.id}.json`), JSON.stringify(saved));
  cache = null;
  return saved;
}

// Reads are cached for 20 s per server instance; a new report clears it.
let cache: { at: number; reports: FieldReport[] } | null = null;
const MAX = 500;

export async function listReports(): Promise<FieldReport[]> {
  if (cache && Date.now() - cache.at < 20_000) return cache.reports;
  let reports: FieldReport[] = [];
  if (BLOB) {
    const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
    const json = blobs.filter((b) => b.pathname.endsWith(".json")).sort((a, b) => +b.uploadedAt - +a.uploadedAt).slice(0, MAX);
    const got = await Promise.all(json.map((b) => fetch(b.url).then((r) => (r.ok ? (r.json() as Promise<FieldReport>) : null)).catch(() => null)));
    reports = got.filter((r): r is FieldReport => r !== null);
  } else if (existsSync(LOCAL)) {
    const files = (await readdir(LOCAL)).filter((f) => f.endsWith(".json"));
    reports = await Promise.all(files.map(async (f) => JSON.parse(await readFile(join(LOCAL, f), "utf8")) as FieldReport));
  }
  reports.sort((a, b) => b.at.localeCompare(a.at));
  cache = { at: Date.now(), reports };
  return reports;
}

// 311 dumping and debris reports per grid cell, so a block near the bar can tip into a hotspot,
// plus its most-reported address and ward to label a new one. From the same build as the hotspots.
let cells: { version: string; byCell: Map<string, CellInfo> } | null = null;
export async function dumping311PerCell(): Promise<Map<string, CellInfo>> {
  const { version } = await hotspotData();
  if (cells?.version === version) return cells.byCell; // 10 MB of text: read once per build, not per request
  const source = await streetReportsText();
  const tally = new Map<string, { n: number; addr: Map<string, number>; ward: Map<number, number> }>();
  if (source) {
    const rows = JSON.parse(source.text) as { type: string; lat: number; lon: number; address?: string; ward?: number | null }[];
    for (const r of rows) {
      if (r.type !== "dumping") continue;
      const c = cellOf(r.lat, r.lon);
      const t = tally.get(c) ?? { n: 0, addr: new Map(), ward: new Map() };
      t.n++;
      if (r.address) t.addr.set(r.address, (t.addr.get(r.address) ?? 0) + 1);
      if (r.ward != null) t.ward.set(r.ward, (t.ward.get(r.ward) ?? 0) + 1);
      tally.set(c, t);
    }
  }
  const top = <K,>(m: Map<K, number>): K | null => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  cells = { version, byCell: new Map([...tally].map(([c, t]) => [c, { count: t.n, address: top(t.addr), ward: top(t.ward) }])) };
  return cells.byCell;
}

/** A hotspot by id, including photo-only ones that exist only in the field reports (e.g. Ballwin, Chesterfield). */
export async function findHotspot(id: string): Promise<Hotspot | undefined> {
  const { byId } = await hotspotData();
  if (!id.startsWith("dumping-")) return byId.get(id);
  return fieldHotspots(await listReports(), byId, await dumping311PerCell()).find((h) => h.id === id) ?? byId.get(id);
}
