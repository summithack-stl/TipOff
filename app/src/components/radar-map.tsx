"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RadarPoint } from "@/components/danger-radar";
import { riskColor } from "@/lib/risk";

type Props = {
  points: RadarPoint[];
  top: Set<string>;
  selected: string | null;
  onSelect: (handle: string) => void;
};

export default function RadarMap({ points, top, selected, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const ring = useRef<L.CircleMarker | null>(null);
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!el.current) return;
    // preferCanvas: ~10k circle markers draw on one canvas instead of 10k SVG nodes.
    const m = L.map(el.current, { preferCanvas: true, zoomControl: false }).setView([38.627, -90.24], 12);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    // OSM tiles, darkened in CSS (.radar-tiles) so the risk colors pop.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: "radar-tiles",
    }).addTo(m);
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    // Lowest risk first so the dangerous ones paint on top.
    for (let i = points.length - 1; i >= 0; i--) {
      const [handle, lat, lon, risk] = points[i];
      const color = riskColor(risk);
      if (top.has(handle)) {
        // Top 50: a DOM marker so it can pulse with CSS. 50 nodes is cheap; 10k would not be.
        L.marker([lat, lon], {
          icon: L.divIcon({ className: "", html: `<span class="radar-top" style="--c:${color}"></span>`, iconSize: [14, 14] }),
          title: `Rank ${i + 1}, risk ${risk}`,
          keyboard: true,
          zIndexOffset: 1000,
        })
          .on("click", () => select.current(handle))
          .addTo(group);
        continue;
      }
      L.circleMarker([lat, lon], {
        radius: 1.5 + risk / 22,
        stroke: false,
        fillColor: color,
        fillOpacity: risk < 35 ? 0.4 : 0.9,
      })
        .on("click", () => select.current(handle))
        .addTo(group);
    }
  }, [points, top]);

  useEffect(() => {
    ring.current?.remove();
    ring.current = null;
    const m = map.current;
    const p = selected ? points.find((b) => b[0] === selected) : undefined;
    if (!m || !p) return;
    ring.current = L.circleMarker([p[1], p[2]], { radius: 12, color: "#fff", weight: 2, fill: false, interactive: false }).addTo(m);
    m.panTo([p[1], p[2]], { animate: true });
  }, [selected, points]);

  return <div ref={el} className="h-full w-full bg-[#0e0e10]" />;
}
