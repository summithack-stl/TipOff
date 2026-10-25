"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { BuildingPanel } from "@/components/building-panel";
import { HotspotPanel } from "@/components/hotspot-panel";
import { CATEGORY_COLOR, CATEGORY_LABEL } from "@/lib/categories";
import { COUNTS } from "@/lib/hotspot-counts";
import { DAYS, HOTSPOT_CATEGORIES, HOUR_BLOCKS, maskActiveAt, type HotspotCategory } from "@/lib/hotspots";
import { useMapHotspots, useVacantBuildings } from "@/lib/map-data";

// Leaflet touches window on import, so the map only loads in the browser.
const RadarMap = dynamic(() => import("@/components/radar-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

type Selected = { kind: "hotspot" | "building"; id: string } | null;

const control = "h-8 rounded-md border bg-background px-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function HotspotRadar() {
  const data = useMapHotspots();
  const hotspots = data.hotspots;
  const [category, setCategory] = useState<HotspotCategory | "all">("all");
  const [ward, setWard] = useState("all");
  const [day, setDay] = useState<number | null>(null);
  const [block, setBlock] = useState<number | null>(null);
  const [showVacant, setShowVacant] = useState(false);
  const vacant = useVacantBuildings(showVacant);
  const [selected, setSelected] = useState<Selected>(null);
  const close = useCallback(() => setSelected(null), []);
  const pickHotspot = useCallback((id: string) => setSelected({ kind: "hotspot", id }), []);
  const pickBuilding = useCallback((id: string) => setSelected({ kind: "building", id }), []);

  const wards = useMemo(
    () => [...new Set(hotspots.map((h) => h[4]).filter((w) => w !== null))].sort((a, b) => a - b),
    [hotspots],
  );
  const shown = useMemo(
    () =>
      hotspots.filter(
        (h) => (category === "all" || h[1] === category) && (ward === "all" || String(h[4]) === ward) && maskActiveAt(h[7], day, block),
      ),
    [hotspots, category, ward, day, block],
  );

  const vacantShown = useMemo(() => (showVacant ? vacant.filter((b) => ward === "all" || String(b[4]) === ward) : null), [vacant, showVacant, ward]);

  const hotspot = selected?.kind === "hotspot" ? hotspots.find((h) => h[0] === selected.id) : undefined;
  const building = selected?.kind === "building" ? vacant.find((b) => b[0] === selected.id) : undefined;
  const at = useMemo(
    () => (hotspot ? { lat: hotspot[2], lon: hotspot[3] } : building ? { lat: building[1], lon: building[2] } : null),
    [hotspot, building],
  );

  // Say what the number counts: it read "900 of 900 repeat hotspots" when the map only ever held
  // the top 300 of each type. COUNTS.total is the same figure the landing page and README quote.
  const tally =
    data.state === "loading"
      ? "Loading hotspots…"
      : data.state === "error"
        ? data.message
        : `${shown.length.toLocaleString()} of ${COUNTS.total.toLocaleString()} repeat hotspots`;

  return (
    <div className="relative h-[var(--app-height)] w-full">
      <RadarMap hotspots={shown} vacant={vacantShown} selected={at} onHotspot={pickHotspot} onBuilding={pickBuilding} />
      {hotspot && <HotspotPanel key={hotspot[0]} id={hotspot[0]} onClose={close} />}
      {building && <BuildingPanel key={building[0]} handle={building[0]} onClose={close} />}

      <div className={`absolute top-3 left-3 z-[1000] flex max-w-[calc(100%-1.5rem)] flex-wrap ${selected ? "md:max-w-[calc(100%-420px-1.5rem)]" : ""} items-center gap-3 rounded-lg border bg-background/90 px-3 py-2 text-sm shadow-lg backdrop-blur`}>
        <div>
          <div className="font-semibold">311 Hotspots</div>
          <div className={`text-xs ${data.state === "error" ? "text-destructive" : "text-muted-foreground"}`}>{tally}</div>
        </div>
        <div className="flex gap-1" role="group" aria-label="Issue type">
          {(["all", ...HOTSPOT_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs aria-pressed:bg-foreground aria-pressed:text-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {c !== "all" && <span className="size-2 rounded-full" style={{ background: CATEGORY_COLOR[c] }} />}
              {c === "all" ? "All" : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          Ward
          <select value={ward} onChange={(e) => setWard(e.target.value)} className={control}>
            <option value="all">All</option>
            {wards.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Day
          <select value={day ?? ""} onChange={(e) => setDay(e.target.value === "" ? null : Number(e.target.value))} className={control}>
            <option value="">Any</option>
            {DAYS.map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Reported
          <select value={block ?? ""} onChange={(e) => setBlock(e.target.value === "" ? null : Number(e.target.value))} className={control}>
            <option value="">Any</option>
            {HOUR_BLOCKS.map(([label], i) => (
              <option key={label} value={i}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showVacant} onChange={(e) => setShowVacant(e.target.checked)} className="size-4 accent-red-500" />
          Nearby vacant buildings
        </label>
        <div className="flex items-center gap-1 text-xs text-muted-foreground" aria-hidden>
          score low
          <span className="h-2 w-20 rounded-full bg-[linear-gradient(90deg,#6b7280,#eab308_35%,#f97316_55%,#dc2626_72%,#991b1b)]" />
          high
        </div>
      </div>
    </div>
  );
}
