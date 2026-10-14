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

const PULSE_SCORE = 80;

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
    // OSM tiles, darkened in CSS (.radar-tiles) so the score colors pop.
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
    // Lowest score first so the worst paint on top.
    for (const h of [...hotspots].sort((a, b) => a.score - b.score)) {
      const fill = riskColor(h.score);
      const radius = 6 + 12 * Math.sqrt(h.report_count / maxReports); // area tracks report count
      const label = `${h.category} hotspot, score ${h.score}, ${h.report_count} reports`;
      if (h.score >= PULSE_SCORE) {
        // Worst hotspots: a DOM marker so it can pulse with CSS. A handful of nodes is cheap.
        L.marker([h.lat, h.lon], {
          icon: L.divIcon({
            className: "",
            html: `<span class="radar-top" style="--c:${fill};--cat:${CATEGORY_COLOR[h.category]};width:${radius * 2}px;height:${radius * 2}px"></span>`,
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
      // Fill = score, ring = issue type.
      L.circleMarker([h.lat, h.lon], { radius, color: CATEGORY_COLOR[h.category], weight: 2, fillColor: fill, fillOpacity: 0.8 })
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

  return <div ref={el} className="h-full w-full bg-[#0e0e10]" />;
}
