import type { MapHotspot } from "@/lib/hotspots";

// Grid clustering for the map. /map draws every one of the ~2,950 hotspots, which at city zoom is
// a wall of overlapping circles. Leaflet.markercluster would do this, but it is another dependency
// and a lot of machinery for one rule, so: bucket by a fixed grid in screen pixels.
//
// Because the grid is in pixels, the rule needs no zoom threshold. Zoomed out, a cell covers a lot
// of ground and buckets fill up; zoomed in, cells cover a few metres and almost every bucket holds
// one hotspot, which is drawn as itself.

/** Pixels per grid cell. Roughly the diameter of the largest marker, so clusters do not overlap. */
export const CELL_PX = 56;

/**
 * Cluster at or below this zoom, draw every hotspot above it.
 *
 * A cluster is a DOM marker (it carries a count), where a plain hotspot is drawn on the shared
 * canvas and costs almost nothing. Clustering at every zoom sounds tidier but puts the DOM count
 * at its worst in the middle: across the real data it peaks at 786 markers around zoom 15, which
 * is heavier than the 2,950 canvas circles it replaces. At 13 and below it stays under ~220, and
 * above 13 a crew is looking at a few blocks and wants to see each one anyway.
 */
export const MAX_CLUSTER_ZOOM = 13;

export type Cluster = {
  /** Centre of the hotspots in this cell. */
  lat: number;
  lon: number;
  /** The hotspots here. Length 1 means draw it as an ordinary marker. */
  items: MapHotspot[];
  /** Highest score in the cell: a cluster should look as urgent as its worst block. */
  score: number;
};

/**
 * Web Mercator pixel position at a given zoom, 256 px tiles. Same projection Leaflet uses, so a
 * cell really is CELL_PX on screen. Reimplemented here so this file stays free of Leaflet and can
 * be unit tested.
 */
export function project(lat: number, lon: number, zoom: number): [x: number, y: number] {
  const scale = 256 * 2 ** zoom;
  const x = ((lon + 180) / 360) * scale;
  // Clamped to the latitudes Mercator can represent; St. Louis is nowhere near, but a bad row
  // should not produce Infinity and take the whole layer with it.
  const sin = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return [x, y];
}

/** Buckets hotspots into fixed screen-sized cells. Order is stable for a given input. */
export function clusterHotspots(hotspots: MapHotspot[], zoom: number, cellPx: number = CELL_PX): Cluster[] {
  const single = (h: MapHotspot): Cluster => ({ lat: h[2], lon: h[3], items: [h], score: h[5] });
  // Zoomed in past the threshold, every hotspot is its own marker.
  if (zoom > MAX_CLUSTER_ZOOM) return hotspots.map(single).sort((a, b) => a.score - b.score);

  const cells = new Map<string, MapHotspot[]>();
  for (const h of hotspots) {
    const [x, y] = project(h[2], h[3], zoom);
    const key = `${Math.floor(x / cellPx)}:${Math.floor(y / cellPx)}`;
    const cell = cells.get(key);
    if (cell) cell.push(h);
    else cells.set(key, [h]);
  }

  const out: Cluster[] = [];
  for (const items of cells.values()) {
    if (items.length === 1) {
      out.push(single(items[0]));
      continue;
    }
    let lat = 0;
    let lon = 0;
    let score = 0;
    for (const h of items) {
      lat += h[2];
      lon += h[3];
      if (h[5] > score) score = h[5];
    }
    out.push({ lat: lat / items.length, lon: lon / items.length, items, score });
  }
  // Weakest first, so the worst clusters paint on top. Same rule the single markers use.
  return out.sort((a, b) => a.score - b.score);
}
