import type { Hotspot } from "@/lib/hotspots";

// Photo reports sent from phones, and how they join the 311 hotspots.
// Type-only import, so node:test can load this file.

export type FieldReport = {
  id: string;
  lat: number;
  lon: number;
  at: string; // ISO time the report was sent
  confidence: number; // the photo check's confidence that it shows dumping, 0-1
  note: string; // what the photo check saw
  photo: string | null; // public URL of the stored photo
};

// Same grid as data/scripts/build_hotspots.py (CELL_LAT, CELL_LON, Python floor division).
const CELL_LAT = 0.0014;
const CELL_LON = 0.0018;
export const MIN_REPORTS = 5;

export function cellOf(lat: number, lon: number): string {
  return `${Math.floor(lat / CELL_LAT)}_${Math.floor(lon / CELL_LON)}`;
}

// The City of St. Louis, with a little margin. Reports outside it are refused.
export function inStLouis(lat: number, lon: number): boolean {
  return lat >= 38.53 && lat <= 38.78 && lon >= -90.33 && lon <= -90.16;
}

// What the city's own records say about one grid cell.
export type CellInfo = { count: number; address: string | null; ward: number | null };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Hotspots touched by photo reports, ready to merge over the map's list by id.
 * A block that already is a hotspot gets its photo count and a reason line. A block that isn't becomes one
 * once its 311 reports plus photo reports reach MIN_REPORTS, the same bar the nightly build uses.
 */
export function fieldHotspots(reports: FieldReport[], existing: Map<string, Hotspot>, base311: Map<string, CellInfo>): Hotspot[] {
  const byCell = new Map<string, FieldReport[]>();
  for (const r of reports) {
    const c = cellOf(r.lat, r.lon);
    byCell.set(c, [...(byCell.get(c) ?? []), r]);
  }
  const out: Hotspot[] = [];
  for (const [cell, rs] of byCell) {
    const id = `dumping-${cell}`;
    const n = rs.length;
    const reason = `${plural(n, "photo report")} from the TipOff app`;
    const known = existing.get(id);
    if (known) {
      out.push({ ...known, field_reports: n, reasons: [reason, ...known.reasons.filter((x) => !x.includes("TipOff app"))] });
      continue;
    }
    const city = base311.get(cell);
    const fromCity = city?.count ?? 0;
    if (fromCity + n < MIN_REPORTS) continue;
    const newest = [...rs].sort((a, b) => b.at.localeCompare(a.at));
    const lat = rs.reduce((s, r) => s + r.lat, 0) / n;
    const lon = rs.reduce((s, r) => s + r.lon, 0) / n;
    const dow = Array(7).fill(0) as number[];
    const hours = Array(24).fill(0) as number[];
    for (const r of rs) {
      const d = new Date(r.at);
      dow[d.getUTCDay()]++;
      hours[d.getUTCHours()]++;
    }
    out.push({
      id,
      category: "dumping",
      lat,
      lon,
      ward: city?.ward ?? null,
      // ponytail: rough score until the nightly build ranks it properly against every other hotspot.
      score: Math.min(100, 30 + 8 * (fromCity + n)),
      report_count: fromCity + n,
      trend: 0,
      peak_day: (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const)[dow.indexOf(Math.max(...dow))],
      peak_hour: hours.indexOf(Math.max(...hours)),
      by_dow: dow,
      by_hour: hours,
      monthly: [],
      rank: 0,
      reports_12m: fromCity + n,
      reports_prev_12m: 0,
      active_weeks_12m: 0,
      report_window: "",
      median_days_to_close: null,
      top_address: city?.address ?? `Near ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      vacant_within_150m: 0,
      nearest_vacant_m: null,
      recent: newest.slice(0, 5).map((r) => ({ opened: r.at.slice(0, 10), code: "TipOff photo report", address: `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}` })),
      reasons: [`New hotspot: ${reason}`, `${plural(fromCity, "311 report")} on this block since 2024`],
      field_reports: n,
      source: "field",
    });
  }
  return out;
}
