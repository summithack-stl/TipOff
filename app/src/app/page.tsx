import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import lite from "../../data/clean/vacant_buildings_lite.json";
import { HotspotRadar, type RadarPoint } from "@/components/hotspot-radar";
import type { Hotspot } from "@/lib/hotspots";

// Every hotspot shipped here lands in the page HTML (all 2,925 = 7 MB), so keep the strongest per category.
// ponytail: top-N cut; fetch panel details per click if the map ever needs every hotspot.
const PER_CATEGORY = 300;

// The real file wins; the fake sample keeps the map working on a fresh clone without data.
function loadHotspots(): Hotspot[] {
  const real = join(process.cwd(), "data/clean/hotspots.json");
  const file = existsSync(real) ? real : join(process.cwd(), "data/sample/hotspots.sample.json");
  const all = (JSON.parse(readFileSync(file, "utf8")) as Hotspot[]).sort((a, b) => b.score - a.score);
  const kept = new Map<string, number>();
  return all.filter((h) => {
    const n = kept.get(h.category) ?? 0;
    kept.set(h.category, n + 1);
    return n < PER_CATEGORY;
  });
}

export default function Home() {
  return <HotspotRadar hotspots={loadHotspots()} vacant={lite as RadarPoint[]} />;
}
