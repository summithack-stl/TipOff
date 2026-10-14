import type { Detection } from "@/components/tracker-overlay";
import { distanceMeters } from "@/lib/issues";

export type Photo = {
  handle: string;
  lat: number;
  lon: number;
  attribution: string;
  hotspot_id?: string;
  after: { file: string; year: number; detections?: Detection[] };
};

// One fetch of public/photos/index.json, shared by every panel the user opens.
let photoIndex: Promise<Photo[]> | undefined;
export const loadPhotos = (): Promise<Photo[]> => (photoIndex ??= fetch("/photos/index.json").then((r) => (r.ok ? r.json() : [])));

// A photo tagged with this hotspot wins; otherwise the nearest one within maxMeters.
export async function nearestPhoto(
  lat: number,
  lon: number,
  maxMeters: number,
  hotspotId?: string,
): Promise<{ photo: Photo; meters: number; exact: boolean } | null> {
  const photos = await loadPhotos();
  const tagged = hotspotId ? photos.find((p) => p.hotspot_id === hotspotId) : undefined;
  if (tagged) return { photo: tagged, meters: distanceMeters({ lat, lon }, tagged), exact: true };
  let best: { photo: Photo; meters: number; exact: boolean } | null = null;
  for (const photo of photos) {
    const meters = distanceMeters({ lat, lon }, photo);
    if (meters <= maxMeters && (!best || meters < best.meters)) best = { photo, meters, exact: false };
  }
  return best;
}
