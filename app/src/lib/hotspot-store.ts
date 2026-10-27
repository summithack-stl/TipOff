import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { toMapHotspot, type Hotspot, type MapHotspot } from "@/lib/hotspots";

// The only place server code reads the hotspot file. The browser gets the slim rows from
// GET /api/hotspots and full detail from GET /api/hotspots/[id]; it never sees this file.
// Read at runtime, not imported, so the build passes before data/scripts/build_hotspots.py has run.
const REAL = join(process.cwd(), "data/clean/hotspots.json");
const SUMMARY = join(process.cwd(), "data/clean/hotspots_summary.json");
const SAMPLE = join(process.cwd(), "data/sample/hotspots.sample.json");

let all: Hotspot[] | undefined;
let byId: Map<string, Hotspot> | undefined;

/** True when the real city data is missing and the fake sample is standing in. */
export function usingSample(): boolean {
  return !existsSync(REAL);
}

export function allHotspots(): Hotspot[] {
  if (!all) {
    const file = usingSample() ? SAMPLE : REAL;
    all = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Hotspot[]) : [];
  }
  return all;
}

export function getHotspot(id: string): Hotspot | undefined {
  byId ??= new Map(allHotspots().map((h) => [h.id, h]));
  return byId.get(id);
}

// Everything the map draws and filters by, and nothing else: ~60 bytes a hotspot instead of ~2 KB.
export function mapHotspots(): MapHotspot[] {
  return allHotspots().map(toMapHotspot);
}

let version: string | undefined;

/**
 * Which nightly build the hotspots came from, e.g. "2026-10-25". Part of the plan cache key, so a
 * rebuilt hotspot gets a fresh plan instead of yesterday's answer about different numbers.
 */
export function dataVersion(): string {
  if (version === undefined) {
    try {
      version = (JSON.parse(readFileSync(SUMMARY, "utf8")) as { generated?: string }).generated ?? "unknown";
    } catch {
      version = usingSample() ? "sample" : "unknown";
    }
  }
  return version;
}
