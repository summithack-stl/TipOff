// 311 rows, cleaned: a port of data/scripts/fetch_311.py minus the download. One CSV row in, one
// report out, keeping place, type and timing only. Free text and caller fields never leave here.

import type { HotspotCategory } from "@/lib/hotspots";
import { npRound } from "./py.ts";

export const CODES: Record<string, HotspotCategory> = {
  "Illegal dumpg report": "dumping", "Debris-alley/street": "dumping", "TDebris-alley/street": "dumping",
  "Debris-Vacant Lot": "dumping", "Debris-Vacant Bldg": "dumping", "Truck dropped litter": "dumping",
  "Potholes - Residnl": "pothole", "Potholes - Major St": "pothole", "Potholes - Alley": "pothole",
  "Graffiti-Private": "graffiti", "Graffiti-Public": "graffiti", "Traffic Graffiti": "graffiti", "Graffiti-Prvt Dmpstr": "graffiti",
};
const LAT_MIN = 38.53, LAT_MAX = 38.78, LON_MIN = -90.33, LON_MAX = -90.16; // City of St. Louis
const EARTH_R = 6378137.0; // Web Mercator sphere radius, meters
const DEG = 180 / Math.PI;

export type StreetReport = {
  id: string; type: HotspotCategory; code: string; lat: number; lon: number;
  opened: string; weekday: string; hour: number; address: string;
  neighborhood: number | null; ward: number | null; status: string; days_to_close: number | null;
};

// read_csv's default NA strings: these read as missing even with dtype=str.
const NA = new Set(["", "#N/A", "#N/A N/A", "#NA", "-1.#IND", "-1.#QNAN", "-NaN", "-nan", "1.#IND", "1.#QNAN", "<NA>", "N/A", "NA", "NULL", "NaN", "None", "n/a", "nan", "null"]);
const str = (v: string | undefined) => (v === undefined || NA.has(v) ? null : v);
const num = (v: string | undefined) => {
  const s = str(v)?.trim();
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/** SRX/SRY are Web Mercator meters (EPSG:3857). */
export function mercatorToLatLon(x: number, y: number): [number, number] {
  return [(2 * Math.atan(Math.exp(y / EARTH_R)) - Math.PI / 2) * DEG, (x / EARTH_R) * DEG];
}

export const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** A city timestamp ("2026-01-01 01:28:07.32"), kept as wall-clock time: ms since epoch, read as UTC. */
export function parseCityTime(v: string | undefined): number | null {
  const m = str(v)?.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = "0", frac = ""] = m;
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) + (frac ? Number(`0.${frac}`) * 1000 : 0);
}

const stamp = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

/** One CSV row in, one kept report out, or null. Location, type and timing only: no free text, no caller. */
export function toStreetReport(row: Record<string, string>): StreetReport | null {
  const code = (str(row.PROBLEMCODE) ?? "").trim();
  const type = CODES[code];
  if (!type) return null;
  const [rawLat, rawLon] = mercatorToLatLon(num(row.SRX), num(row.SRY));
  const lat = npRound(rawLat, 5), lon = npRound(rawLon, 5);
  if (!(lat >= LAT_MIN && lat <= LAT_MAX && lon >= LON_MIN && lon <= LON_MAX)) return null;
  const opened = parseCityTime(row.DATETIMEINIT);
  if (opened === null) return null;
  const closed = parseCityTime(row.DATETIMECLOSED);
  const int = (v: string | undefined) => (Number.isNaN(num(v)) ? null : num(v));
  return {
    id: (str(row.REQUESTID) ?? "").trim(), type, code, lat, lon,
    opened: stamp(opened), weekday: WEEKDAY[new Date(opened).getUTCDay()], hour: new Date(opened).getUTCHours(),
    address: (str(row.PROBADDRESS) ?? "").trim(),
    neighborhood: int(row.NEIGHBORHOOD), ward: int(row.WARD),
    status: (str(row.STATUS) ?? "").trim(),
    days_to_close: closed === null ? null : npRound((closed - opened) / 86_400_000, 1),
  };
}

/** Keep the first of each request id, as drop_duplicates("id") does. */
export function dedupe(reports: StreetReport[]): StreetReport[] {
  const seen = new Set<string>();
  return reports.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}
