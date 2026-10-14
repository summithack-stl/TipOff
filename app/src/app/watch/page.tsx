import photos from "../../../public/photos/index.json";
import { WatchPlayer } from "@/components/watch-player";
import type { Detection, Keyframe } from "@/components/tracker-overlay";

type PhotoEntry = {
  address: string;
  lat: number;
  lon: number;
  featured?: boolean;
  after: { file: string; detections?: Detection[] };
};

// Featured buildings play as a photo sequence: each photo is one keyframe.
const keyframes: Keyframe[] = (photos as PhotoEntry[])
  .filter((p) => p.featured && p.after.detections?.length)
  .map((p, i) => ({ t: i, lat: p.lat, lon: p.lon, image: `/photos/${p.after.file}`, detections: p.after.detections ?? [] }));

export default function WatchPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <WatchPlayer photos={keyframes} />
      <p className="mt-3 text-xs text-muted-foreground">Street imagery: Mapillary contributors, CC BY-SA 4.0.</p>
    </div>
  );
}
