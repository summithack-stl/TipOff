import type { DAYS, Hotspot } from "@/lib/hotspots";

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

// 311 times are when people REPORT dumping, not when it happens. Our assumption (not measured): the drop
// happens in the hours before reports start, so suggested drive-bys cover the 12 hours before the report window.
export function watchWindow(h: Hotspot): string {
  const w = parseWindow(h.report_window);
  if (!w) return `Before ${h.report_window}`;
  const start = w[0];
  return `${hourLabel((start + 12) % 24)}–${hourLabel(start)}`;
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
  if (last) lines.push(`Latest 311: ${last.code}, ${last.opened}`);
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
