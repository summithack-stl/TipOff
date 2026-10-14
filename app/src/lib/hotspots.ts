// Repeat 311 hotspots. ponytail: shape guessed until Arjun's hotspots.json lands; adjust here only.
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
};

// Hour blocks for the time filter: [label, first hour, last hour].
export const HOUR_BLOCKS = [
  ["Night 0-5", 0, 5],
  ["Morning 6-11", 6, 11],
  ["Afternoon 12-17", 12, 17],
  ["Evening 18-23", 18, 23],
] as const;

// "Active" on a day or in an hour block = more reports there than an even spread would give.
export function activeAt(h: Hotspot, day: number | null, block: number | null): boolean {
  if (day !== null && h.by_dow[day] * 7 < h.report_count) return false;
  if (block !== null) {
    const [, from, to] = HOUR_BLOCKS[block];
    const inBlock = h.by_hour.slice(from, to + 1).reduce((a, b) => a + b, 0);
    if (inBlock * 24 < h.report_count * (to - from + 1)) return false;
  }
  return true;
}

export function formatHour(h: number): string {
  return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
}
