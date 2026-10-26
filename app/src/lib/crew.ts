import type { DAYS, Hotspot } from "@/lib/hotspots";
import { reportLabel } from "./report-codes.ts";

// Helpers for the crew view ("today's hotspots"). Type-only import, so node:test can load this file.

export type Day = (typeof DAYS)[number];
const WEEK: readonly Day[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Same rule as activeAt() in hotspots.ts: a busy day has more reports than an even spread would give.
const busyOn = (h: Hotspot, d: number) => h.by_dow[d] * 7 >= h.report_count;

// Weekday in St. Louis, whatever time zone the server runs in.
export function cityToday(now: Date = new Date()): Day {
  const name = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Chicago" }).format(now);
  return (WEEK as readonly string[]).includes(name) ? (name as Day) : "Sun";
}

// "8am-11am" -> [8, 11]. Null if the format is unexpected.
export function parseWindow(window: string): [number, number] | null {
  const m = /^(\d{1,2})(am|pm)-(\d{1,2})(am|pm)$/.exec(window.trim());
  if (!m) return null;
  const to24 = (h: string, ap: string) => (Number(h) % 12) + (ap === "pm" ? 12 : 0);
  return [to24(m[1], m[2]), to24(m[3], m[4])];
}

const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h % 24 < 12 ? "am" : "pm"}`;

// Days with more reports than an even spread would give, e.g. ["Mon", "Wed"].
export function busyDays(h: Hotspot): Day[] {
  return WEEK.filter((_, i) => busyOn(h, i));
}

// A hotspot needs this many reports before its busiest report hours mean anything.
const MIN_REPORTS_FOR_WINDOW = 8;
// ...and its 3-hour report window has to hold this much more than an even spread would give.
// Below that the "peak" is just noise, and naming an hour would be making it up.
const MIN_CONCENTRATION = 1.5;
// A window a crew can actually staff. The old rule said "the 12 hours before reports start", which
// for the #1 hotspot printed "12am-12pm": true to the assumption, useless as advice.
const WATCH_HOURS = 6;

export type Watch =
  /** A window worth driving: "2am-8am". */
  | { window: string; note: null }
  /** Not enough signal to name hours. Say so instead of inventing one. */
  | { window: null; note: string };

/** Share of reports landing in the 3-hour report window, against an even spread across the day. */
function concentration(h: Hotspot, start: number): number {
  const total = h.by_hour.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  const inWindow = [0, 1, 2].reduce((n, i) => n + h.by_hour[(start + i) % 24], 0);
  return (inWindow / total) / (3 / 24);
}

// 311 times are when people REPORT dumping, not when it happens. Our assumption (not measured): the
// drop happens in the hours before reports start, so a drive-by covers the WATCH_HOURS before the
// report window opens. Where the data is too thin to place that window, say so.
export function watchWindow(h: Hotspot): Watch {
  const parsed = parseWindow(h.report_window);
  if (!parsed) return { window: null, note: `Reports are logged ${h.report_window}; no clear window to watch.` };

  if (h.report_count < MIN_REPORTS_FOR_WINDOW) {
    return { window: null, note: `Only ${h.report_count} reports here, too few to pick an hour. Watch on the busy days.` };
  }
  const start = parsed[0];
  if (concentration(h, start) < MIN_CONCENTRATION) {
    return { window: null, note: "Reports come in right through the day here, so no hours stand out. Watch on the busy days." };
  }
  return { window: `${hourLabel((start - WATCH_HOURS + 24) % 24)}\u2013${hourLabel(start)}`, note: null };
}

export type Finding = { category: string; severity: string; note: string };

// One short line on what is at the spot: photo findings first, else the latest 311 report.
export function whatsThere(h: Hotspot, photoFindings: Finding[] | undefined): string[] {
  const lines: string[] = [];
  const same = (photoFindings ?? []).filter((f) => f.category === h.category);
  if (same.length) {
    const top = same[0];
    lines.push(`Street photo: ${top.note || h.category}${top.severity === "high" ? " (severe)" : ""}`);
  } else if (photoFindings) {
    lines.push("Street photo on file, nothing flagged in it");
  }
  const last = h.recent[0];
  if (last) lines.push(`Latest 311: ${reportLabel(last.code)}, ${last.opened}`);
  if (h.category === "dumping" && h.vacant_within_150m > 0) {
    lines.push(`${h.vacant_within_150m} vacant building${h.vacant_within_150m === 1 ? "" : "s"} within 150 m`);
  }
  return lines;
}

// Hotspots with a busy report day today, strongest first.
export function todaysHotspots(all: Hotspot[], day: Day, perCategory = 10): Hotspot[] {
  const d = WEEK.indexOf(day);
  const kept = new Map<string, number>();
  return all
    .filter((h) => busyOn(h, d))
    .sort((a, b) => b.score - a.score)
    .filter((h) => {
      const n = kept.get(h.category) ?? 0;
      kept.set(h.category, n + 1);
      return n < perCategory;
    });
}
