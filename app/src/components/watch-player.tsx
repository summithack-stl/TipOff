"use client";

import { useEffect, useState } from "react";
import { TrackerOverlay, type Keyframe } from "@/components/tracker-overlay";

type Replay = { clip: string; video: string; keyframes: Keyframe[] };

// /watch plays the featured building photos. /watch?clip=drive1 plays public/replay/drive1.json over its video instead.
export function WatchPlayer({ photos }: { photos: Keyframe[] }) {
  const [replay, setReplay] = useState<Replay | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const clip = new URLSearchParams(window.location.search).get("clip");
    if (!clip || !/^[\w-]+$/.test(clip)) return;
    fetch(`/replay/${clip}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`no replay file for "${clip}"`))))
      .then((data: Replay) => setReplay(data))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (replay) return <TrackerOverlay key="video" video={replay.video} keyframes={replay.keyframes} />;
  return <TrackerOverlay key="photos" keyframes={photos} loop />;
}
