import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import { toMapHotspot, type Hotspot, type MapHotspot } from "@/lib/hotspots";
import type { HotspotSummary } from "@/lib/refresh/build";
import { readLatest, readPublished } from "@/lib/refresh/store";

// The only place server code reads hotspot data. The browser gets the slim rows from
// GET /api/hotspots and full detail from GET /api/hotspots/[id]; it never sees these files.
//
// Two sources: the nightly refresh's published run (Blob), and app/data/clean, bundled with the
// deploy and still rebuilt by the GitHub refresh. The newer data wins, the published run on a tie.
// The fake sample stands in only when neither exists (a fresh clone with no data).
const DATA = join(process.cwd(), "data/clean");
const SAMPLE = join(process.cwd(), "data/sample/hotspots.sample.json");
// How often a server instance looks for a newer published run. Data changes once a night.
const CHECK_MS = 10 * 60_000;

export type HotspotData = {
  hotspots: Hotspot[];
  byId: Map<string, Hotspot>;
  summary: HotspotSummary;
  source: "refresh" | "bundled" | "sample";
  /** Which build this is: the refresh run id, or the bundled summary's date. Keys the plan cache. */
  version: string;
  /** Where the matching 311 street reports are, or null for the sample. */
  streetReports: string | null;
};

const index = (d: Omit<HotspotData, "byId">): HotspotData => ({ ...d, byId: new Map(d.hotspots.map((h) => [h.id, h])) });

let bundledData: HotspotData | undefined;
function bundled(): HotspotData {
  if (bundledData) return bundledData;
  const real = join(DATA, "hotspots.json");
  if (!existsSync(real)) {
    const hotspots = existsSync(SAMPLE) ? (JSON.parse(readFileSync(SAMPLE, "utf8")) as Hotspot[]) : [];
    const counts: Record<string, number> = {};
    for (const h of hotspots) counts[h.category] = (counts[h.category] ?? 0) + 1;
    return (bundledData = index({ hotspots, summary: { generated: "sample", window_end: "", counts, top: {} }, source: "sample", version: "sample", streetReports: null }));
  }
  const summary = JSON.parse(readFileSync(join(DATA, "hotspots_summary.json"), "utf8")) as HotspotSummary;
  return (bundledData = index({
    hotspots: JSON.parse(readFileSync(real, "utf8")) as Hotspot[],
    summary, source: "bundled", version: summary.generated, streetReports: join(DATA, "street_reports.json"),
  }));
}

async function load(previous: HotspotData | undefined): Promise<HotspotData> {
  const local = bundled();
  const latest = await readLatest().catch((error: unknown) => {
    console.error("refresh data unavailable, using the bundled data:", error);
    return null;
  });
  if (!latest || (local.source === "bundled" && local.summary.window_end > latest.windowEnd)) return local;
  if (previous?.source === "refresh" && previous.version === latest.runId) return previous;
  const [hotspots, summary] = await Promise.all([
    readPublished(latest.files["hotspots.json"]).then((t) => JSON.parse(t) as Hotspot[]),
    readPublished(latest.files["hotspots_summary.json"]).then((t) => JSON.parse(t) as HotspotSummary),
  ]);
  return index({ hotspots, summary, source: "refresh", version: latest.runId, streetReports: latest.files["street_reports.json"] });
}

let current: { data: HotspotData; at: number } | undefined;
let loading: Promise<HotspotData> | undefined;

/** The hotspots in use now. Checked for a newer run at most every CHECK_MS; a failed check keeps what is loaded. */
export async function hotspotData(): Promise<HotspotData> {
  if (current && Date.now() - current.at < CHECK_MS) return current.data;
  loading ??= load(current?.data)
    .then((data) => {
      current = { data, at: Date.now() };
      return data;
    })
    .catch((error: unknown) => {
      console.error("could not load the published refresh:", error);
      const data = current?.data ?? bundled();
      current = { data, at: Date.now() };
      return data;
    })
    .finally(() => (loading = undefined));
  return loading;
}

export const getHotspot = async (id: string) => (await hotspotData()).byId.get(id);

// Everything the map draws and filters by, and nothing else: ~60 bytes a hotspot instead of ~2 KB.
export const mapHotspots = async (): Promise<MapHotspot[]> => (await hotspotData()).hotspots.map(toMapHotspot);

/** The street reports behind the current hotspots, as text, or null when there are none. */
export async function streetReportsText(): Promise<{ version: string; text: string } | null> {
  const d = await hotspotData();
  if (!d.streetReports) return null;
  const text = d.source === "refresh" ? await readPublished(d.streetReports) : existsSync(d.streetReports) ? readFileSync(d.streetReports, "utf8") : null;
  return text === null ? null : { version: d.version, text };
}

/**
 * The summary and hotspots for prerendered pages (landing, map totals). Cached for an hour, so the
 * pages stay static and still pick up a new refresh without a redeploy.
 */
export async function pageData(): Promise<{ summary: HotspotSummary; hotspots: Hotspot[] }> {
  "use cache";
  cacheLife("hours");
  const { summary, hotspots } = await hotspotData();
  return { summary, hotspots };
}
