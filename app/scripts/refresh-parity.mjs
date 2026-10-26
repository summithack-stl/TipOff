// Checks the TypeScript refresh (src/lib/refresh/build.ts) against the Python scripts it replaces.
//
// Run the Python pipeline first, into any checkout, then point this at it:
//   python data/scripts/fetch_311.py && python data/scripts/build_hotspots.py && python data/scripts/backtest.py
//   node scripts/refresh-parity.mjs <that checkout>
//
// Both sides read the same street_reports.json, so this checks the hotspot build and the backtest.
// Exits 1 on any difference beyond the float tolerance, and prints the first few.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { backtest, buildHotspots } from "../src/lib/refresh/build.ts";

const root = process.argv[2];
if (!root) throw new Error("usage: node scripts/refresh-parity.mjs <checkout with the Python output>");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const reports = read("app/data/clean/street_reports.json");
const vacant = read("app/data/clean/vacant_buildings_lite.json");
const want = { hotspots: read("app/data/clean/hotspots.json"), lite: read("app/data/clean/hotspots_lite.json"), summary: read("app/data/clean/hotspots_summary.json") };

const t0 = performance.now();
const got = buildHotspots(reports, vacant, want.summary.generated);
const t1 = performance.now();
const bt = backtest(reports, vacant);
const t2 = performance.now();

const diffs = [];
// `recent` is the 10 newest reports; pandas sorts them with an unstable quicksort, so reports filed in
// the same minute can come out in either order. Compare the dates, which a tie cannot change.
const norm = (k, v) => (k === "recent" ? v.map((x) => x.opened) : v);
// median_days_to_close may differ by 0.1 when the median falls on .x5: pandas' read_json parses
// "0.3" as 3 * 0.1 = 0.30000000000000004, so Python rounds a nudged midpoint. Same data, float noise.
const tolerance = (path) => (path.endsWith(".median_days_to_close") ? 0.1 + 1e-9 : 1e-9);
function compare(path, a, b) {
  if (typeof a === "number" && typeof b === "number") {
    if (Math.abs(a - b) > tolerance(path)) diffs.push(`${path}: ts ${a} vs py ${b}`);
  } else if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) diffs.push(`${path}: length ts ${a.length} vs py ${b.length}`);
    else a.forEach((x, i) => compare(`${path}[${i}]`, x, b[i]));
  } else if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) compare(`${path}.${k}`, norm(k, a[k]), norm(k, b[k]));
  } else if (a !== b) diffs.push(`${path}: ts ${JSON.stringify(a)} vs py ${JSON.stringify(b)}`);
}

compare("hotspots", got.hotspots, want.hotspots);
compare("lite", got.lite, want.lite);
compare("summary", got.summary, want.summary);
compare("backtest", bt, read("data/backtest/results.json"));

console.log(`${reports.length} reports -> ${got.hotspots.length} hotspots in ${Math.round(t1 - t0)} ms, backtest in ${Math.round(t2 - t1)} ms`);
if (diffs.length) {
  console.log(`${diffs.length} differences, first 20:`);
  for (const d of diffs.slice(0, 20)) console.log(`  ${d}`);
  process.exit(1);
}
console.log("matches the Python output (allowing the two documented differences above)");
