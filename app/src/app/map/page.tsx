import summary from "../../../data/clean/hotspots_summary.json";
import { HotspotRadar } from "@/components/hotspot-radar";

// Nothing is inlined into this page any more. The hotspots come from the static /api/hotspots and
// the vacant-building layer from /api/vacant only once a crew switches it on; together those two
// imports used to make this page megabytes of HTML on every load, painful on a cellular connection.
// Only the citywide totals stay here, which are a few hundred bytes.
export default function MapPage() {
  return <HotspotRadar totals={summary.counts} />;
}
