// Hotspots and the backtest from cleaned 311 reports: a port of data/scripts/build_hotspots.py
// and backtest.py. scripts/refresh-parity.mjs checks it against the Python scripts on the same file.

import type { Hotspot, HotspotCategory } from "@/lib/hotspots";
// The one grid in JavaScript, shared with photo reports. Relative and with their extensions, so
// node:test can load these as well as the bundler.
import { cellOf, MIN_REPORTS } from "../field-reports.ts";
import { mean, median, mode, npRound, pctRank, pyRound } from "./py.ts";
import { pad, WEEKDAY, type StreetReport } from "./street-reports.ts";

const DAY_MS = 86_400_000;

/** Busiest 3-hour block of report times, e.g. "2pm-5pm". */
export function peakWindow(hours: number[]): string {
  const c = new Array(24).fill(0);
  for (const h of hours) c[h]++;
  let start = 0, best = -1;
  for (let h = 0; h < 24; h++) {
    const s = c[h] + c[(h + 1) % 24] + c[(h + 2) % 24];
    if (s > best) [best, start] = [s, h];
  }
  const fmt = (h: number) => `${h % 12 || 12}${h % 24 < 12 ? "am" : "pm"}`;
  return `${fmt(start)}-${fmt(start + 3)}`;
}

export function meters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

/** The vacant-buildings lite rows: [handle, lat, lon, risk, ward]. */
export type VacantRow = [string, number, number, number, number | null];

type Report = StreetReport & { t: number; week: string; month: string; cell: string };

const parseOpened = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13), +s.slice(14, 16));
// pandas to_period("W"): weeks run Monday to Sunday. The Monday names the week.
const weekOf = (t: number) => new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10);

function prepare(reports: StreetReport[]): Report[] {
  return reports.map((r) => {
    const t = parseOpened(r.opened);
    return { ...r, t, week: weekOf(t), month: r.opened.slice(0, 7), cell: cellOf(r.lat, r.lon) };
  });
}

/** groupby(keys): groups in sorted key order, rows in their original order. */
function groupBy<T>(rows: T[], key: (r: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const g = m.get(k);
    if (g) g.push(r);
    else m.set(k, [r]);
  }
  return [...m].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function months24(end: number): string[] {
  const d = new Date(end);
  const out: string[] = [];
  for (let i = 23; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(`${m.getUTCFullYear()}-${pad(m.getUTCMonth() + 1)}`);
  }
  return out;
}

function vacantNear(lat: number, lon: number, vacant: VacantRow[]) {
  let within = 0, nearest = Infinity;
  for (const v of vacant) {
    const d = meters(lat, lon, v[1], v[2]);
    if (d <= 150) within++;
    if (d < nearest) nearest = d;
  }
  return { within, nearest: vacant.length ? Math.trunc(nearest) : null };
}

const topAddress = (g: Report[]) => (g.some((r) => r.address.length > 0) ? (mode(g.map((r) => r.address)) ?? "") : "");
const score = (volume: number, activeWeeks: number, trend: number, vacant: number) =>
  100 * (0.4 * volume + 0.3 * Math.min(activeWeeks / 52, 1) + (0.15 * (Math.max(-1, Math.min(1, trend)) + 1)) / 2 + 0.15 * Math.min(vacant / 3, 1));

/** Stable sort, highest score first, then most reports in the last 12 months. */
const byScore = <T extends { score: number; reports_12m: number }>(xs: T[]) =>
  xs.map((x, i) => [x, i] as const).sort((a, b) => b[0].score - a[0].score || b[0].reports_12m - a[0].reports_12m || a[1] - b[1]).map(([x]) => x);

export type HotspotSummary = { generated: string; window_end: string; counts: Record<string, number>; top: Record<string, string[]> };
export type HotspotLite = [string, HotspotCategory, number, number, number, number];

export function buildHotspots(reports: StreetReport[], vacant: VacantRow[], today: string) {
  const r = prepare(reports);
  const end = Math.max(...r.map((x) => x.t));
  const months = months24(end);
  const rows: Omit<Hotspot, "score" | "rank" | "reasons">[] = [];

  for (const [key, g] of groupBy(r, (x) => `${x.type}\u0000${x.cell}`)) {
    if (g.length < MIN_REPORTS) continue;
    const [kind, cell] = key.split("\u0000") as [HotspotCategory, string];
    const lat = npRound(mean(g.map((x) => x.lat)), 5), lon = npRound(mean(g.map((x) => x.lon)), 5);
    const recent = g.map((x, i) => [x, i] as const).sort((a, b) => b[0].t - a[0].t || a[1] - b[1]).slice(0, 10).map(([x]) => x);
    const byDow = WEEKDAY.map((d) => g.filter((x) => x.weekday === d).length);
    const byHour = new Array(24).fill(0);
    for (const x of g) byHour[x.hour]++;
    const perMonth = new Map<string, number>();
    for (const x of g) perMonth.set(x.month, (perMonth.get(x.month) ?? 0) + 1);
    const in12 = g.filter((x) => x.t > end - 365 * DAY_MS);
    const r12 = in12.length;
    const prev = g.filter((x) => x.t <= end - 365 * DAY_MS && x.t > end - 730 * DAY_MS).length;
    const wards = g.map((x) => x.ward).filter((w): w is number => w !== null);
    const closes = g.map((x) => x.days_to_close).filter((d): d is number => d !== null);
    const near = vacantNear(lat, lon, vacant);
    rows.push({
      id: `${kind}-${cell}`, category: kind, lat, lon,
      ward: wards.length ? (mode(wards) ?? null) : null,
      report_count: g.length,
      trend: pyRound((r12 - prev) / Math.max(prev, 1), 2),
      peak_day: WEEKDAY[byDow.indexOf(Math.max(...byDow))] as Hotspot["peak_day"],
      peak_hour: byHour.indexOf(Math.max(...byHour)),
      by_dow: byDow, by_hour: byHour,
      monthly: months.map((m) => ({ month: m, count: perMonth.get(m) ?? 0 })),
      reports_12m: r12, reports_prev_12m: prev,
      active_weeks_12m: new Set(in12.map((x) => x.week)).size,
      report_window: peakWindow(g.map((x) => x.hour)),
      median_days_to_close: closes.length ? pyRound(median(closes), 1) : null,
      top_address: topAddress(g),
      vacant_within_150m: near.within, nearest_vacant_m: near.nearest,
      recent: recent.map((x) => ({ opened: x.opened.slice(0, 10), code: x.code, address: x.address })),
    });
  }

  // Score within each category, so potholes don't drown out dumping.
  const volume = new Array<number>(rows.length);
  for (const [, idx] of groupBy(rows.map((_, i) => i), (i) => rows[i].category)) {
    pctRank(idx.map((i) => rows[i].reports_12m)).forEach((p, k) => (volume[idx[k]] = p));
  }
  const scored = byScore(rows.map((h, i) => ({ ...h, score: npRound(score(volume[i], h.active_weeks_12m, h.trend, h.vacant_within_150m)) })));
  const seen = new Map<string, number>();
  const hotspots: Hotspot[] = scored.map((h) => {
    const rank = (seen.get(h.category) ?? 0) + 1;
    seen.set(h.category, rank);
    return { ...h, rank, reasons: reasons(h) };
  });

  const counts: Record<string, number> = {};
  const top: Record<string, string[]> = {};
  for (const [cat, g] of groupBy(hotspots, (h) => h.category)) {
    counts[cat] = g.length;
    top[cat] = g.slice(0, 10).map((h) => h.id);
  }
  const lite: HotspotLite[] = hotspots.map((h) => [h.id, h.category, h.lat, h.lon, h.score, h.reports_12m]);
  const summary: HotspotSummary = { generated: today, window_end: new Date(end).toISOString().slice(0, 10), counts, top };
  return { hotspots, lite, summary };
}

function reasons(x: Omit<Hotspot, "rank" | "reasons">): string[] {
  const out = [`${x.reports_12m} reports in the last 12 months`];
  if (x.active_weeks_12m >= 4) out.push(`reported in ${x.active_weeks_12m} different weeks this year`);
  if (x.reports_prev_12m && x.reports_12m > 1.2 * x.reports_prev_12m) out.push(`up from ${x.reports_prev_12m} the year before`);
  if (x.vacant_within_150m) out.push(`${x.vacant_within_150m} vacant buildings within 150 m`);
  out.push(`most reports on ${x.peak_day}, mostly reported ${x.report_window}`);
  return out;
}

// ---------------------------------------------------------------- backtest (backtest.py)

/** Score dumping hotspots as of a year ago using only reports before then; count reports in the year after. */
export function backtest(reports: StreetReport[], vacant: VacantRow[]) {
  const r = prepare(reports.filter((x) => x.type === "dumping"));
  const last = Math.max(...r.map((x) => x.t));
  const cut = last - 365 * DAY_MS;
  const past = r.filter((x) => x.t <= cut), future = r.filter((x) => x.t > cut);
  const after = new Map<string, number>();
  for (const x of future) after.set(x.cell, (after.get(x.cell) ?? 0) + 1);

  const rows = groupBy(past, (x) => x.cell)
    .filter(([, g]) => g.length >= MIN_REPORTS)
    .map(([cell, g]) => {
      const in12 = g.filter((x) => x.t > cut - 365 * DAY_MS);
      const prev = g.filter((x) => x.t <= cut - 365 * DAY_MS && x.t > cut - 730 * DAY_MS).length;
      return {
        cell, reports_12m: in12.length,
        trend: (in12.length - prev) / Math.max(prev, 1),
        active_weeks_12m: new Set(in12.map((x) => x.week)).size,
        vacant_within_150m: vacantNear(mean(g.map((x) => x.lat)), mean(g.map((x) => x.lon)), vacant).within,
        address: topAddress(g),
      };
    });
  if (!rows.length) throw new Error("backtest: no hotspots before the cutoff");
  const volume = pctRank(rows.map((x) => x.reports_12m));
  const h = byScore(rows.map((x, i) => ({ ...x, score: score(volume[i], x.active_weeks_12m, x.trend, x.vacant_within_150m), after: after.get(x.cell) ?? 0 })));

  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  const summary = {
    cutoff: day(cut), hidden_window_end: day(last), reports_after_cutoff: future.length, hotspots_scored: h.length,
    top: Object.fromEntries([10, 25, 50, 100].map((n) => [n, {
      dumped_on_again: h.slice(0, n).filter((x) => x.after > 0).length,
      three_plus: h.slice(0, n).filter((x) => x.after >= 3).length,
    }])),
  };
  const top50 = h.slice(0, 50).map((x, i) => ({
    rank: i + 1, cell: x.cell, address: x.address, score: pyRound(x.score, 1),
    reports_scored_year: x.reports_12m, reports_hidden_year: x.after,
  }));
  return { summary, top50 };
}
