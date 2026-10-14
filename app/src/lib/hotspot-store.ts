import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Hotspot } from "@/lib/hotspots";

// Server-side lookup for /api/plan. The browser gets hotspots via the page, never this file.
// Read at runtime, not imported, so the build passes before data/scripts/build_hotspots.py has run;
// until then every id is unknown (404).
const FILE = join(process.cwd(), "data/clean/hotspots.json");

let byId: Map<string, Hotspot> | undefined;

export function getHotspot(id: string): Hotspot | undefined {
  byId ??= new Map(
    existsSync(FILE) ? (JSON.parse(readFileSync(FILE, "utf8")) as Hotspot[]).map((h) => [h.id, h]) : [],
  );
  return byId.get(id);
}
