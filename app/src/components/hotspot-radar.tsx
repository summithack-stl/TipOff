"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { BuildingPanel } from "@/components/building-panel";
import { HotspotPanel } from "@/components/hotspot-panel";
import { TypeToggle } from "@/components/type-toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CATEGORY_LABEL } from "@/lib/categories";
import { DAYS, HOUR_BLOCKS, maskActiveAt, toMapHotspot, type Hotspot, type HotspotCategory } from "@/lib/hotspots";
import { useMapHotspots, useVacantBuildings } from "@/lib/map-data";

// Leaflet touches window on import, so the map only loads in the browser.
const RadarMap = dynamic(() => import("@/components/radar-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#0e0f11]" />,
});

type Selected = { kind: "hotspot" | "building"; id: string } | null;
const ANY = "any";

function Filter({ label, value, onChange, items }: { label: string; value: string; onChange: (v: string) => void; items: Record<string, string> }) {
  return (
    <label className="flex items-center gap-2">
      <span className="font-heading text-sm font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <Select value={value} onValueChange={(v) => onChange(v ?? ANY)} items={items}>
        <SelectTrigger size="sm" className="min-w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(items).map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

// totals: every hotspot of each type citywide, from the nightly summary. The map now fetches all
// of them from the static /api/hotspots rather than having them inlined into the page HTML, so the
// tally no longer needs a "top N" caveat.
export function HotspotRadar({ totals }: { totals: Record<string, number> }) {
  const data = useMapHotspots();
  const base = data.hotspots;
  // One type at a time: dumping is the problem set, the others are a click away.
  const [category, setCategory] = useState<HotspotCategory>("dumping");
  const [ward, setWard] = useState(ANY);
  const [day, setDay] = useState(ANY);
  const [block, setBlock] = useState(ANY);
  const [showVacant, setShowVacant] = useState(false);
  // 400 KB, off by default: fetched the first time it is switched on, and never otherwise.
  const vacant = useVacantBuildings(showVacant);
  // /map?h=<id> opens that hotspot: "Share this block" sends it, and so does a photo report. undefined means nobody has touched
  // the map yet, so the link still decides; derived rather than set in an effect, so the panel opens
  // as soon as the rows holding that hotspot arrive.
  const shared = useSearchParams().get("h");
  const [picked, setPicked] = useState<Selected | undefined>(undefined);
  const selected: Selected = picked !== undefined ? picked : shared ? { kind: "hotspot", id: shared } : null;
  const close = useCallback(() => setPicked(null), []);
  const pickHotspot = useCallback((id: string) => setPicked({ kind: "hotspot", id }), []);
  const pickBuilding = useCallback((id: string) => setPicked({ kind: "building", id }), []);
  // Photo reports from phones (/api/reports) update known hotspots and add new ones without waiting
  // for the nightly build. They arrive whole, so the panel gets them as `initial`: /api/hotspots/[id]
  // only knows the nightly file.
  const [fromField, setFromField] = useState<Hotspot[]>([]);
  useEffect(() => {
    let live = true;
    fetch("/api/reports")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { hotspots?: Hotspot[] } | null) => {
        if (live && d?.hotspots) setFromField(d.hotspots);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const fieldById = useMemo(() => new Map(fromField.map((h) => [h.id, h])), [fromField]);
  const hotspots = useMemo(() => {
    if (!fieldById.size) return base;
    const known = new Set(base.map((h) => h[0]));
    const added = fromField.filter((h) => !known.has(h.id)).map(toMapHotspot);
    return [...base.map((h) => (fieldById.has(h[0]) ? toMapHotspot(fieldById.get(h[0])!) : h)), ...added];
  }, [base, fromField, fieldById]);
  const wards = useMemo(() => [...new Set(hotspots.map((h) => h[4]).filter((w) => w !== null))].sort((a, b) => a - b), [hotspots]);
  const ofType = useMemo(() => hotspots.filter((h) => h[1] === category), [hotspots, category]);
  const shown = useMemo(
    () =>
      ofType.filter(
        (h) =>
          (ward === ANY || String(h[4]) === ward) &&
          maskActiveAt(h[7], day === ANY ? null : Number(day), block === ANY ? null : Number(block)),
      ),
    [ofType, ward, day, block],
  );
  const vacantShown = useMemo(() => (showVacant ? vacant.filter((b) => ward === ANY || String(b[4]) === ward) : null), [vacant, showVacant, ward]);

  const hotspot = selected?.kind === "hotspot" ? hotspots.find((h) => h[0] === selected.id) : undefined;
  const building = selected?.kind === "building" ? vacant.find((b) => b[0] === selected.id) : undefined;
  const at = useMemo(
    () => (hotspot ? { lat: hotspot[2], lon: hotspot[3] } : building ? { lat: building[1], lon: building[2] } : null),
    [hotspot, building],
  );

  return (
    <div className="flex h-[calc(var(--app-height)-4rem)] w-full flex-col md:h-[var(--app-height)]">
      <div className="z-[1050] flex flex-wrap items-center gap-x-5 gap-y-2 border-b bg-background px-4 py-2.5 text-sm">
        <TypeToggle
          value={category}
          onChange={(c) => {
          setCategory(c);
          setPicked(null);
        }}
        />
        <Filter label="Ward" value={ward} onChange={setWard} items={{ [ANY]: "All", ...Object.fromEntries(wards.map((w) => [String(w), String(w)])) }} />
        <Filter label="Day" value={day} onChange={setDay} items={{ [ANY]: "Any", ...Object.fromEntries(DAYS.map((d, i) => [String(i), d])) }} />
        <Filter label="Reported" value={block} onChange={setBlock} items={{ [ANY]: "Any time", ...Object.fromEntries(HOUR_BLOCKS.map(([l], i) => [String(i), l])) }} />
        <label className="flex items-center gap-2">
          <Switch checked={showVacant} onCheckedChange={setShowVacant} />
          <span className="font-heading text-sm font-semibold tracking-wide text-muted-foreground uppercase">Vacant buildings</span>
        </label>
        <p className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
          {data.state === "loading"
            ? "Loading hotspots…"
            : data.state === "error"
              ? data.message
              : `${shown.length.toLocaleString("en-US")} of ${(totals[category] ?? ofType.length).toLocaleString("en-US")} ${CATEGORY_LABEL[category].toLowerCase()} hotspots · size = reports, brightness = score`}
        </p>
      </div>

      <div className="relative isolate flex-1 overflow-hidden">
        <RadarMap hotspots={shown} vacant={vacantShown} selected={at} onHotspot={pickHotspot} onBuilding={pickBuilding} />
        <AnimatePresence>
          {hotspot && <HotspotPanel key={hotspot[0]} id={hotspot[0]} initial={fieldById.get(hotspot[0])} onClose={close} />}
          {building && <BuildingPanel key={building[0]} handle={building[0]} onClose={close} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
