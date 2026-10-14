import "server-only";

import data from "../../data/clean/vacant_buildings.json";

// One record per vacant building, written by data/scripts/fetch_vacant_buildings.py.
export type Building = {
  handle: string;
  parcel_id: string;
  address: string;
  lat: number;
  lon: number;
  ward: number | null;
  neighborhood: number | null;
  year_built: number | null;
  vacant_since: number | null;
  months_vacant: number;
  major_violations: number;
  minor_violations: number;
  complaints_311: number;
  unpaid_fees: number;
  lra_owned: boolean;
  risk_score: number;
  risk_rank: number;
  risk_reasons: string[];
};

const buildings = data as Building[];
const byHandle = new Map(buildings.map((b) => [b.handle, b]));

export function getBuilding(handle: string): Building | undefined {
  return byHandle.get(handle);
}
