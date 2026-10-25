// Repeat 311 hotspots, one per ~155 m cell and issue type.
export const HOTSPOT_CATEGORIES = ["dumping", "pothole", "graffiti"] as const;
export type HotspotCategory = (typeof HOTSPOT_CATEGORIES)[number];

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type Hotspot = {
  id: string;
  category: HotspotCategory;
  lat: number;
  lon: number;
  ward: number | null;
  score: number; // 0-100, higher = act here first
  report_count: number;
  trend: number; // last 12 months vs the 12 before, e.g. 0.25 = +25%
  peak_day: (typeof DAYS)[number];
  peak_hour: number; // 0-23
  by_dow: number[]; // 7 counts, Sun first
  by_hour: number[]; // 24 counts
  monthly: { month: string; count: number }[]; // "2025-03"
  // From data/scripts/build_hotspots.py, used by the panel and /api/plan.
  rank: number; // within its category
  reports_12m: number;
  reports_prev_12m: number;
  active_weeks_12m: number;
  report_window: string; // busiest 3-hour block of REPORT times, e.g. "2pm-5pm"
  median_days_to_close: number | null;
  top_address: string;
  vacant_within_150m: number;
  nearest_vacant_m: number | null;
  recent: { opened: string; code: string; address: string }[];
  reasons: string[];
};

// Hour blocks for the time filter: [label, first hour, last hour].
export const HOUR_BLOCKS = [
  ["Night 0-5", 0, 5],
  ["Morning 6-11", 6, 11],
  ["Afternoon 12-17", 12, 17],
  ["Evening 18-23", 18, 23],
] as const;

// What the map needs for every hotspot, as one array per row to keep the payload small.
// Full detail (monthly history, recent reports, reasons) is fetched per hotspot on click.
export type MapHotspot = [
  id: string,
  category: HotspotCategory,
  lat: number,
  lon: number,
  ward: number | null,
  score: number,
  reportCount: number,
  /** activityMask(): bits 0-6 are busy weekdays (Sun first), bits 7-10 busy hour blocks. */
  activity: number,
];

// "Active" on a day or in an hour block = more reports there than an even spread would give.
// Packed into one integer at build time so by_dow and by_hour never reach the browser.
export function activityMask(h: Pick<Hotspot, "by_dow" | "by_hour" | "report_count">): number {
  let mask = 0;
  for (let day = 0; day < 7; day++) {
    if (h.by_dow[day] * 7 >= h.report_count) mask |= 1 << day;
  }
  HOUR_BLOCKS.forEach(([, from, to], i) => {
    const inBlock = h.by_hour.slice(from, to + 1).reduce((a, b) => a + b, 0);
    if (inBlock * 24 >= h.report_count * (to - from + 1)) mask |= 1 << (7 + i);
  });
  return mask;
}

export function maskActiveAt(mask: number, day: number | null, block: number | null): boolean {
  if (day !== null && !(mask & (1 << day))) return false;
  if (block !== null && !(mask & (1 << (7 + block)))) return false;
  return true;
}

// Kept for server code that still holds a whole Hotspot. Same answer as the packed mask.
export function activeAt(h: Hotspot, day: number | null, block: number | null): boolean {
  return maskActiveAt(activityMask(h), day, block);
}

export function formatHour(h: number): string {
  return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
}
