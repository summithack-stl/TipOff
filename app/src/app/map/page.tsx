import lite from "../../../data/clean/vacant_buildings_lite.json";
import { HotspotRadar, type RadarPoint } from "@/components/hotspot-radar";
import { loadHotspots, topPerCategory } from "@/lib/hotspot-data";

// Every hotspot shipped here lands in the page HTML (all 2,925 = 7 MB), so keep the strongest per category.
// ponytail: top-N cut; fetch panel details per click if the map ever needs every hotspot.
const PER_CATEGORY = 300;

export default function MapPage() {
  return <HotspotRadar hotspots={topPerCategory(loadHotspots().hotspots, PER_CATEGORY)} vacant={lite as RadarPoint[]} />;
}
