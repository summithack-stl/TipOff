import type { Detection } from "@/components/tracker-overlay";
import { distanceMeters } from "@/lib/issues";

export type Photo = {
  handle: string;
  lat: number;
  lon: number;
  attribution: string;
  after: { file: string; year: number; detections?: Detection[] };
};

// One fetch of public/photos/index.json, shared by every panel the user opens.
let photoIndex: Promise<Photo[]> | undefined;
export const loadPhotos = (): Promise<Photo[]> => (photoIndex ??= fetch("/photos/index.json").then((r) => (r.ok ? r.json() : [])));

export async function nearestPhoto(lat: number, lon: number, maxMeters: number): Promise<{ photo: Photo; meters: number } | null> {
  let best: { photo: Photo; meters: number } | null = null;
  for (const photo of await loadPhotos()) {
    const meters = distanceMeters({ lat, lon }, photo);
    if (meters <= maxMeters && (!best || meters < best.meters)) best = { photo, meters };
  }
  return best;
}
