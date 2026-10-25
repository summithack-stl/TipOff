"use client";

import { useEffect, useRef, useState } from "react";
import type { Hotspot, MapHotspot } from "@/lib/hotspots";

export type MapData =
  | { state: "loading"; hotspots: MapHotspot[] }
  | { state: "ready"; hotspots: MapHotspot[] }
  | { state: "error"; hotspots: MapHotspot[]; message: string };

// The map's hotspots, fetched from the static /api/hotspots instead of inlined into the page HTML.
// One request, cached hard by the CDN and by the service worker.
export function useMapHotspots(): MapData {
  const [data, setData] = useState<MapData>({ state: "loading", hotspots: [] });

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/hotspots", { signal: abort.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`hotspots unavailable (${res.status})`);
        return (await res.json()) as MapHotspot[];
      })
      .then((hotspots) => setData({ state: "ready", hotspots }))
      .catch((error: unknown) => {
        if (abort.signal.aborted) return; // unmounted or re-run, not a failure worth showing
        setData({ state: "error", hotspots: [], message: error instanceof Error ? error.message : String(error) });
      });
    return () => abort.abort();
  }, []);

  return data;
}

export type HotspotDetail =
  | { state: "loading"; hotspot: Hotspot | null }
  | { state: "ready"; hotspot: Hotspot }
  | { state: "error"; hotspot: null; message: string };

// Full detail for one hotspot. The map holds only slim rows, so it fetches on click; the crew list
// already has the whole hotspot server-side and passes it as `initial`, which skips the request.
export function useHotspot(id: string, initial?: Hotspot): HotspotDetail {
  const [detail, setDetail] = useState<HotspotDetail>(
    initial ? { state: "ready", hotspot: initial } : { state: "loading", hotspot: null },
  );

  useEffect(() => {
    if (initial) return;
    const abort = new AbortController();
    fetch(`/api/hotspots/${encodeURIComponent(id)}`, { signal: abort.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`could not load this hotspot (${res.status})`);
        return (await res.json()) as Hotspot;
      })
      .then((hotspot) => setDetail({ state: "ready", hotspot }))
      .catch((error: unknown) => {
        if (abort.signal.aborted) return;
        setDetail({ state: "error", hotspot: null, message: error instanceof Error ? error.message : String(error) });
      });
    return () => abort.abort();
  }, [id, initial]);

  return detail;
}

export type VacantPoint = [handle: string, lat: number, lon: number, risk: number, ward: number | null];

// The vacant-building layer, fetched the first time a crew switches it on and kept after that.
// Off by default, so an unopened layer costs nothing.
export function useVacantBuildings(enabled: boolean): VacantPoint[] {
  const [points, setPoints] = useState<VacantPoint[]>([]);
  // A ref, not state: whether we have already asked does not affect what is rendered.
  const asked = useRef(false);

  useEffect(() => {
    if (!enabled || asked.current) return;
    asked.current = true;
    const abort = new AbortController();
    fetch("/api/vacant", { signal: abort.signal })
      .then((res) => (res.ok ? (res.json() as Promise<VacantPoint[]>) : []))
      .then(setPoints)
      .catch(() => {
        if (!abort.signal.aborted) setPoints([]); // the layer is context, not the point of the map
      });
    return () => abort.abort();
  }, [enabled]);

  return points;
}
