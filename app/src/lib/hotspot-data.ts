import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Hotspot } from "@/lib/hotspots";

// The real file wins; the fake sample keeps every page working on a fresh clone without data.
export function loadHotspots(): { hotspots: Hotspot[]; sample: boolean } {
  const real = join(process.cwd(), "data/clean/hotspots.json");
  const sample = !existsSync(real);
  const file = sample ? join(process.cwd(), "data/sample/hotspots.sample.json") : real;
  return { hotspots: JSON.parse(readFileSync(file, "utf8")) as Hotspot[], sample };
}

// Strongest first, at most `perCategory` of each type.
export function topPerCategory(all: Hotspot[], perCategory: number): Hotspot[] {
  const kept = new Map<string, number>();
  return [...all]
    .sort((a, b) => b.score - a.score)
    .filter((h) => {
      const n = kept.get(h.category) ?? 0;
      kept.set(h.category, n + 1);
      return n < perCategory;
    });
}
