"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

export type RadarPoint = [handle: string, lat: number, lon: number, risk: number, ward: number | null];

// Leaflet touches window on import, so the map only loads in the browser.
const RadarMap = dynamic(() => import("@/components/radar-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

const TOP = 50;

export function DangerRadar({ buildings }: { buildings: RadarPoint[] }) {
  const [ward, setWard] = useState("all");
  const [minRisk, setMinRisk] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const wards = useMemo(() => [...new Set(buildings.map((b) => b[4]).filter((w) => w !== null))].sort((a, b) => a - b), [buildings]);
  const top = useMemo(() => new Set(buildings.slice(0, TOP).map((b) => b[0])), [buildings]);
  const shown = useMemo(
    () => buildings.filter((b) => b[3] >= minRisk && (ward === "all" || String(b[4]) === ward)),
    [buildings, ward, minRisk],
  );

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] w-full">
      <RadarMap points={shown} top={top} selected={selected} onSelect={setSelected} />

      <div className="absolute top-3 left-3 z-[1000] flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-3 rounded-lg border bg-background/90 px-3 py-2 text-sm shadow-lg backdrop-blur">
        <div>
          <div className="font-semibold">Danger Radar</div>
          <div className="text-xs text-muted-foreground">
            {shown.length.toLocaleString()} of {buildings.length.toLocaleString()} vacant buildings
          </div>
        </div>
        <label className="flex items-center gap-2">
          Ward
          <select
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="all">All</option>
            {wards.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Min risk
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={minRisk}
            onChange={(e) => setMinRisk(Number(e.target.value))}
            className="w-28 accent-red-500"
          />
          <span className="w-6 tabular-nums">{minRisk}</span>
        </label>
        <div className="flex items-center gap-1 text-xs text-muted-foreground" aria-hidden>
          low
          <span className="h-2 w-24 rounded-full bg-[linear-gradient(90deg,#6b7280,#eab308_35%,#f97316_55%,#dc2626_72%,#991b1b)]" />
          high
        </div>
      </div>
    </div>
  );
}
