import { boundaries } from "./service-boundaries.ts";

export type ServiceArea = "stl" | "ballwin" | "chesterfield";
type Bounds = [[number, number], [number, number]];
export const SERVICE_AREAS: Record<ServiceArea, { label: string; center: { lat: number; lon: number }; bounds: Bounds }> = {
  stl: { label: "St. Louis City", center: { lat: 38.627, lon: -90.199 }, bounds: [[38.53, -90.33], [38.78, -90.16]] },
  ballwin: { label: "Ballwin", center: { lat: 38.5947255, lon: -90.5499603 }, bounds: extent(boundaries.ballwin) },
  chesterfield: { label: "Chesterfield", center: { lat: 38.6588695, lon: -90.57944 }, bounds: extent(boundaries.chesterfield) },
};
export const SERVICE_BOUNDS: Bounds = [[38.53, Math.min(SERVICE_AREAS.ballwin.bounds[0][1], SERVICE_AREAS.chesterfield.bounds[0][1])], [38.78, -90.16]];

function extent(rings: number[][][]): Bounds {
  const points = rings.flat();
  return [[Math.min(...points.map(p => p[1])), Math.min(...points.map(p => p[0]))], [Math.max(...points.map(p => p[1])), Math.max(...points.map(p => p[0]))]];
}

// Preserve the existing city acceptance area; county additions use municipal polygons.
export function inStLouis(lat: number, lon: number): boolean {
  return lat >= 38.53 && lat <= 38.78 && lon >= -90.33 && lon <= -90.16;
}

function inside(lat: number, lon: number, rings: number[][][]): boolean {
  let hit = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, y] = ring[i];
      const [px, py] = ring[j];
      if ((y > lat) !== (py > lat) && lon < (px - x) * (lat - y) / (py - y) + x) hit = !hit;
    }
  }
  return hit;
}

export function areaForPoint(lat: number, lon: number): ServiceArea | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (inStLouis(lat, lon)) return "stl";
  for (const area of ["ballwin", "chesterfield"] as const) {
    const [sw, ne] = SERVICE_AREAS[area].bounds;
    if (lat >= sw[0] && lat <= ne[0] && lon >= sw[1] && lon <= ne[1] && inside(lat, lon, boundaries[area])) return area;
  }
  return null;
}

export const inServiceArea = (lat: number, lon: number): boolean => areaForPoint(lat, lon) !== null;
