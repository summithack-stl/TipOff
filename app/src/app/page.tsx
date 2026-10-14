import lite from "../../data/clean/vacant_buildings_lite.json";
import { DangerRadar, type RadarPoint } from "@/components/danger-radar";

// [handle, lat, lon, risk_score, ward], sorted by risk_rank (index 0 = rank 1).
const buildings = lite as RadarPoint[];

export default function Home() {
  return <DangerRadar buildings={buildings} />;
}
