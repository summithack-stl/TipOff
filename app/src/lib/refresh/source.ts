// Fetching the city's 311 file for the refresh: the network half of data/scripts/fetch_311.py.
//
// csb.zip is ~128 MB and holds every year since 2008, but only 2024-2026 are used. The city's
// server answers byte ranges, so this reads the zip's directory from its tail and then fetches just
// those three entries (~28 MB), inflating and parsing them as they stream, with nothing on disk.
// If a server ever ignores ranges, it falls back to downloading the whole file into memory.

import { dedupe, toStreetReport, type StreetReport } from "./street-reports.ts";

export const CSB_URL = "https://www.stlouis-mo.gov/data/upload/data-files/csb.zip";
export const YEARS = ["2024", "2025", "2026"];

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
type Bytes = (start: number, end: number) => Promise<ReadableStream<Uint8Array>>; // end inclusive

/** One quoted-CSV parser that takes the file in chunks (RFC 4180: "" escapes, newlines inside quotes). */
export class CsvRows {
  private header: string[] | null = null;
  private field = "";
  private row: string[] = [];
  private quoted = false;
  private quoteSeen = false;

  push(text: string): Record<string, string>[] {
    const out: Record<string, string>[] = [];
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (this.quoted) {
        if (c !== '"') {
          this.field += c;
        } else if (text[i + 1] === '"') {
          this.field += '"';
          i++;
        } else {
          this.quoted = false;
          // At the end of a chunk, a closing quote might be the first half of "": the next chunk decides.
          this.quoteSeen = i + 1 === text.length;
        }
        continue;
      }
      if (this.quoteSeen) {
        this.quoteSeen = false;
        if (c === '"') {
          this.field += '"';
          this.quoted = true;
          continue;
        }
      }
      if (c === '"') this.quoted = true;
      else if (c === ",") {
        this.row.push(this.field);
        this.field = "";
      } else if (c === "\n") this.finish(out);
      else if (c !== "\r") this.field += c;
    }
    return out;
  }

  end(): Record<string, string>[] {
    const out: Record<string, string>[] = [];
    if (this.field || this.row.length) this.finish(out);
    return out;
  }

  private finish(out: Record<string, string>[]) {
    this.row.push(this.field);
    this.field = "";
    const cells = this.row;
    this.row = [];
    if (!this.header) { this.header = cells; return; }
    if (cells.length === 1 && cells[0] === "") return; // blank line
    const rec: Record<string, string> = {};
    this.header.forEach((h, i) => (rec[h] = cells[i] ?? ""));
    out.push(rec);
  }
}

/** Byte ranges from the server, or slices of a full download when it won't do ranges. */
async function byteSource(url: string, fetchImpl: Fetch): Promise<{ size: number; bytes: Bytes; ranged: boolean }> {
  const tail = await fetchImpl(url, { headers: { range: "bytes=-65557" } });
  if (!tail.ok) throw new Error(`311 file: the city answered ${tail.status}`);
  const total = Number(tail.headers.get("content-range")?.split("/")[1]);
  if (tail.status === 206 && Number.isFinite(total)) {
    return {
      size: total, ranged: true,
      bytes: async (start, end) => {
        const res = await fetchImpl(url, { headers: { range: `bytes=${start}-${end}` } });
        if (res.status !== 206 || !res.body) throw new Error(`311 file: range ${start}-${end} answered ${res.status}`);
        return res.body;
      },
    };
  }
  const whole = new Uint8Array(await tail.arrayBuffer());
  return { size: whole.length, ranged: false, bytes: async (start, end) => new Blob([whole.slice(start, end + 1)]).stream() };
}

const readAll = async (s: ReadableStream<Uint8Array>) => new Uint8Array(await new Response(s).arrayBuffer());

type Entry = { name: string; method: number; compressed: number; offset: number };

async function directory(size: number, bytes: Bytes): Promise<Map<string, Entry>> {
  const start = Math.max(0, size - 65557);
  const tail = await readAll(await bytes(start, size - 1));
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("311 file: not a zip (no end of central directory)");
  const cdSize = view.getUint32(eocd + 12, true), cdOffset = view.getUint32(eocd + 16, true);
  const cd = await readAll(await bytes(cdOffset, cdOffset + cdSize - 1));
  const v = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const entries = new Map<string, Entry>();
  for (let p = 0; p + 46 <= cd.length && v.getUint32(p, true) === 0x02014b50; ) {
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const name = new TextDecoder().decode(cd.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { name, method: v.getUint16(p + 10, true), compressed: v.getUint32(p + 20, true), offset: v.getUint32(p + 42, true) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** One entry's text, streamed: its local header gives where the data starts. */
async function* entryText(e: Entry, bytes: Bytes): AsyncGenerator<string> {
  const head = await readAll(await bytes(e.offset, e.offset + 29));
  const hv = new DataView(head.buffer, head.byteOffset, head.byteLength);
  if (hv.getUint32(0, true) !== 0x04034b50) throw new Error(`311 file: bad local header for ${e.name}`);
  const dataStart = e.offset + 30 + hv.getUint16(26, true) + hv.getUint16(28, true);
  let stream = await bytes(dataStart, dataStart + e.compressed - 1);
  if (e.method === 8) stream = stream.pipeThrough(new DecompressionStream("deflate-raw") as unknown as TransformStream<Uint8Array, Uint8Array>);
  else if (e.method !== 0) throw new Error(`311 file: ${e.name} uses zip method ${e.method}`);
  // utf-8 with replacement characters, as read_csv(encoding_errors="replace") reads it.
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return void (yield decoder.decode());
    yield decoder.decode(value, { stream: true });
  }
}

export type FetchStats = { ranged: boolean; rows: number; kept: number; byType: Record<string, number> };

/** The cleaned street reports for YEARS, as fetch_311.py writes them, plus what it took to get them. */
export async function fetchStreetReports(url = CSB_URL, fetchImpl: Fetch = fetch): Promise<{ reports: StreetReport[]; stats: FetchStats }> {
  const { size, bytes, ranged } = await byteSource(url, fetchImpl);
  const entries = await directory(size, bytes);
  const kept: StreetReport[] = [];
  let rows = 0;
  for (const year of YEARS) {
    const e = entries.get(`${year}.csv`);
    if (!e) throw new Error(`311 file: no ${year}.csv inside (found ${[...entries.keys()].join(", ")})`);
    const csv = new CsvRows();
    const take = (recs: Record<string, string>[]) => {
      rows += recs.length;
      for (const r of recs) {
        const s = toStreetReport(r);
        if (s) kept.push(s);
      }
    };
    for await (const text of entryText(e, bytes)) take(csv.push(text));
    take(csv.end());
  }
  const reports = dedupe(kept);
  const byType: Record<string, number> = {};
  for (const r of reports) byType[r.type] = (byType[r.type] ?? 0) + 1;
  return { reports, stats: { ranged, rows, kept: reports.length, byType } };
}
