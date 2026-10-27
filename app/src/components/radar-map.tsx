"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapHotspot } from "@/lib/hotspots";
import type { VacantPoint } from "@/lib/map-data";
import { CATEGORY_COLOR } from "@/lib/categories";
import { clusterHotspots } from "@/lib/cluster";
import { riskColor } from "@/lib/risk";

type Props = {
  hotspots: MapHotspot[];
  vacant: VacantPoint[] | null; // null = layer off
  selected: { lat: number; lon: number } | null;
  onHotspot: (id: string) => void;
  onBuilding: (handle: string) => void;
};

const PULSE_TOP = 10; // the strongest hotspots on screen pulse
const INITIAL_ZOOM = 12;

export default function RadarMap({ hotspots, vacant, selected, onHotspot, onBuilding }: Props) {
  const el = useRef<HTMLDivElement>(null);
  // Clusters are a grid in screen pixels, so they have to be rebuilt whenever the zoom changes.
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
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
    const m = L.map(el.current, { preferCanvas: true, zoomControl: false }).setView([38.627, -90.24], INITIAL_ZOOM);
    m.on("zoomend", () => setZoom(m.getZoom()));
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
    const maxReports = Math.max(1, ...hotspots.map((h) => h[6]));
    // Grid clustering, so a city-wide view is readable instead of a wall of overlapping circles.
    // Weakest first, so the worst still paint on top. One type is shown at a time, so color = type,
    // size = report count, brightness = score.
    const clusters = clusterHotspots(hotspots, zoom);
    const singles = clusters.filter((c) => c.items.length === 1);
    const pulse = new Set(singles.slice(-PULSE_TOP).map((c) => c.items[0][0]));
    for (const cluster of clusters) {
      if (cluster.items.length > 1) {
        const { lat, lon, items, score } = cluster;
        const fill = riskColor(score);
        const radius = 14 + Math.min(10, Math.log2(items.length) * 3);
        L.marker([lat, lon], {
          icon: L.divIcon({
            className: "",
            html: `<span class="radar-cluster" style="--c:${fill};width:${radius * 2}px;height:${radius * 2}px">${items.length}</span>`,
            iconSize: [radius * 2, radius * 2],
          }),
          title: `${items.length} hotspots here, worst score ${score}. Zoom in to open one.`,
          keyboard: true,
        })
          // A cluster is not a place, so it opens no panel: it zooms to show what is inside.
          .on("click", () => map.current?.setView([lat, lon], Math.min(19, map.current.getZoom() + 3)))
          .addTo(group);
        continue;
      }
      const [id, category, lat, lon, , score, reportCount, , address] = cluster.items[0];
      const color = CATEGORY_COLOR[category];
      const radius = 4 + 12 * Math.sqrt(reportCount / maxReports);
      const label = `${address || category}: score ${score}, ${reportCount} reports`;
      if (pulse.has(id)) {
        // Worst hotspots: a DOM marker so it can pulse with CSS. A handful of nodes is cheap.
        L.marker([lat, lon], {
          icon: L.divIcon({
            className: "",
            html: `<span class="radar-top" style="--c:${color};width:${radius * 2}px;height:${radius * 2}px"></span>`,
            iconSize: [radius * 2, radius * 2],
          }),
          title: label,
          keyboard: true,
          zIndexOffset: 1000,
        })
          .on("click", () => handlers.current.onHotspot(id))
          .addTo(group);
        continue;
      }
      L.circleMarker([lat, lon], { radius, color, weight: 1, opacity: 0.9, fillColor: color, fillOpacity: 0.15 + 0.6 * (score / 100) })
        .bindTooltip(label)
        .on("click", () => handlers.current.onHotspot(id))
        .addTo(group);
    }
  }, [hotspots, zoom]);

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
