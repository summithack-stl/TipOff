import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { backtest, buildHotspots, type VacantRow } from "./build.ts";
import { fetchStreetReports } from "./source.ts";
import { canStart, finished, refuseSnapshot, started, type RunRecord } from "./status.ts";
import { publish, readLatest, readStatus, StatusConflict, storeConfigured, writeStatus } from "./store.ts";

// The day as St. Louis has it, for the summary's "generated" date.
const cityDay = (now: number) => new Date(now).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const runIdOf = (now: number) => new Date(now).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

/**
 * One refresh: download the city's 311 file, rebuild hotspots and the backtest, check the result
 * against what is published, and publish it. Every outcome is recorded in the status, including a
 * refusal. Returns the record, or a refusal without one when another run holds the lock.
 */
export async function runRefresh(by: string): Promise<{ status: 200 | 409 | 500 | 503; run: RunRecord }> {
  const t0 = Date.now();
  if (!storeConfigured()) {
    return { status: 503, run: { at: new Date(t0).toISOString(), by, ok: false, error: "Refresh storage isn't set up on this deployment (no Blob store)." } };
  }

  const { status, etag } = await readStatus();
  const may = canStart(status, t0);
  if (!may.ok) return { status: 409, run: { at: new Date(t0).toISOString(), by, ok: false, error: may.reason } };
  try {
    await writeStatus(started(status, by, t0), etag);
  } catch (error) {
    if (error instanceof StatusConflict) return { status: 409, run: { at: new Date(t0).toISOString(), by, ok: false, error: "Another refresh started at the same moment." } };
    throw error;
  }

  let run: RunRecord;
  try {
    const { reports } = await fetchStreetReports();
    const vacant = JSON.parse(await readFile(join(process.cwd(), "data/clean/vacant_buildings_lite.json"), "utf8")) as VacantRow[];
    const { hotspots, lite, summary } = buildHotspots(reports, vacant, cityDay(t0));
    const results = backtest(reports, vacant);
    const prev = await readLatest();
    const facts = { reports: reports.length, counts: summary.counts, windowEnd: summary.window_end };
    const refused = refuseSnapshot(facts, prev && { reports: Infinity, counts: prev.counts, windowEnd: prev.windowEnd });
    if (refused) throw new Error(`Not published: ${refused}`);

    const runId = runIdOf(t0);
    await publish(runId, {
      "hotspots.json": JSON.stringify(hotspots),
      "hotspots_lite.json": JSON.stringify(lite),
      "hotspots_summary.json": JSON.stringify(summary, null, 2),
      "street_reports.json": JSON.stringify(reports),
      "backtest.json": JSON.stringify(results),
    }, { at: new Date().toISOString(), generated: summary.generated, windowEnd: summary.window_end, counts: summary.counts });
    run = { at: new Date().toISOString(), by, ok: true, ms: Date.now() - t0, runId, windowEnd: summary.window_end, counts: summary.counts, reports: reports.length };
  } catch (error) {
    run = { at: new Date().toISOString(), by, ok: false, ms: Date.now() - t0, error: error instanceof Error ? error.message : String(error) };
  }

  // Re-read for the current etag: this run holds the lock, so nothing else has written since.
  const now = await readStatus();
  await writeStatus(finished(now.status, run), now.etag);
  return { status: run.ok ? 200 : 500, run };
}
