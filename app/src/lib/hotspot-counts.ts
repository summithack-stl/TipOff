import summary from "../../data/clean/hotspots_summary.json";
import { HOTSPOT_CATEGORIES, type HotspotCategory } from "@/lib/hotspots";

// One source of truth for every hotspot count shown in the app or the README. The landing page said
// "1,186 dumping hotspots ranked", the map said "900 of 900 repeat hotspots" and the README said
// 1,173: three numbers counting three different things. Say which is which at the call site.
//
// Kept out of hotspots.ts so that file stays importable from node --test, which cannot read a JSON
// import without an import attribute. Numbers come from the nightly data/scripts/build_hotspots.py.
export const COUNTS = {
  /** Every repeat hotspot the build produced, all three issue types. */
  total: HOTSPOT_CATEGORIES.reduce((n, c) => n + summary.counts[c], 0),
  /** Repeat hotspots of one issue type. */
  byCategory: summary.counts as Record<HotspotCategory, number>,
  /** Last day of 311 data in this build, e.g. "2026-10-24". */
  windowEnd: summary.window_end,
} as const;
