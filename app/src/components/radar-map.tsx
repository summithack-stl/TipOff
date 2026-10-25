"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RadarPoint } from "@/components/hotspot-radar";
import type { Hotspot } from "@/lib/hotspots";
import { CATEGORY_COLOR } from "@/lib/categories";
import { riskColor } from "@/lib/risk";

type Props = {
  hotspots: Hotspot[];
  vacant: RadarPoint[] | null; // null = layer off
  selected: { lat: number; lon: number } | null;
  onHotspot: (id: string) => void;
  onBuilding: (handle: string) => void;
};

const PULSE_TOP = 10; // the strongest hotspots on screen pulse

export default function RadarMap({ hotspots, vacant, selected, onHotspot, onBuilding }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const hotLayer = useRef<L.LayerGroup | null>(null);
  const vacantLayer = useRef<L.LayerGroup | null>(null);
  const ring = useRef<L.CircleMarker | null>(null);
  const handlers = useRef({ onHotspot, onBuilding });
  useEffect(() => {
    handlers.current = { onHotspot, onBuilding };
  }, [onHotspot, onBuilding]);

  useEffect(() => {
    if (!el.current) return;
    // preferCanvas: ~10k circle markers draw on one canvas instead of 10k SVG nodes.
    const m = L.map(el.current, { preferCanvas: true, zoomControl: false }).setView([38.627, -90.24], 12);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    // OSM tiles, darkened in CSS (.radar-tiles) in both themes so the type colors pop.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: "radar-tiles",
    }).addTo(m);
    map.current = m;
    vacantLayer.current = L.layerGroup().addTo(m); // added first so hotspots paint on top
    hotLayer.current = L.layerGroup().addTo(m);
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const group = vacantLayer.current;
    if (!group) return;
    group.clearLayers();
    // Supporting layer: small and dim so it never competes with the hotspots.
    for (const [handle, lat, lon, risk] of vacant ?? []) {
      L.circleMarker([lat, lon], { radius: 2, stroke: false, fillColor: riskColor(risk), fillOpacity: 0.35 })
        .on("click", () => handlers.current.onBuilding(handle))
        .addTo(group);
    }
  }, [vacant]);

  useEffect(() => {
    const group = hotLayer.current;
    if (!group) return;
    group.clearLayers();
    const maxReports = Math.max(1, ...hotspots.map((h) => h.report_count));
    // Lowest score first so the worst paint on top. One type is shown at a time, so color = type,
    // size = report count, brightness = score.
    const sorted = [...hotspots].sort((a, b) => a.score - b.score);
    const pulse = new Set(sorted.slice(-PULSE_TOP).map((h) => h.id));
    for (const h of sorted) {
      const color = CATEGORY_COLOR[h.category];
      const radius = 4 + 12 * Math.sqrt(h.report_count / maxReports);
      const label = `${h.top_address || h.category}: score ${h.score}, ${h.report_count} reports`;
      if (pulse.has(h.id)) {
        // Worst hotspots: a DOM marker so it can pulse with CSS. A handful of nodes is cheap.
        L.marker([h.lat, h.lon], {
          icon: L.divIcon({
            className: "",
            html: `<span class="radar-top" style="--c:${color};width:${radius * 2}px;height:${radius * 2}px"></span>`,
            iconSize: [radius * 2, radius * 2],
          }),
          title: label,
          keyboard: true,
          zIndexOffset: 1000,
        })
          .on("click", () => handlers.current.onHotspot(h.id))
          .addTo(group);
        continue;
      }
      L.circleMarker([h.lat, h.lon], { radius, color, weight: 1, opacity: 0.9, fillColor: color, fillOpacity: 0.15 + 0.6 * (h.score / 100) })
        .bindTooltip(label)
        .on("click", () => handlers.current.onHotspot(h.id))
        .addTo(group);
    }
  }, [hotspots]);

  useEffect(() => {
    ring.current?.remove();
    ring.current = null;
    const m = map.current;
    if (!m || !selected) return;
    ring.current = L.circleMarker([selected.lat, selected.lon], { radius: 22, color: "#fff", weight: 2, fill: false, interactive: false }).addTo(m);
    m.panTo([selected.lat, selected.lon], { animate: true });
  }, [selected]);

  return <div ref={el} className="h-full w-full bg-[#0e0f11]" />;
}
