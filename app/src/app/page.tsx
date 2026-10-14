import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import lite from "../../data/clean/vacant_buildings_lite.json";
import { HotspotRadar, type RadarPoint } from "@/components/hotspot-radar";
import type { Hotspot } from "@/lib/hotspots";

// Arjun's real file wins; the fake sample keeps the map working until it lands.
// ponytail: drop the sample fallback once data/clean/hotspots.json is on main.
function loadHotspots(): Hotspot[] {
  const real = join(process.cwd(), "data/clean/hotspots.json");
  const file = existsSync(real) ? real : join(process.cwd(), "data/sample/hotspots.sample.json");
  return JSON.parse(readFileSync(file, "utf8")) as Hotspot[];
}

export default function Home() {
  return <HotspotRadar hotspots={loadHotspots()} vacant={lite as RadarPoint[]} />;
}
