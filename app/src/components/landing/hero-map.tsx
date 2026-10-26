"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CATEGORY_COLOR } from "@/lib/categories";

// [lat, lon, score, reports]
export type HeroPoint = [number, number, number, number];

const PULSE_TOP = 12;

// Backdrop only: no dragging or zooming, so scrolling the page never gets caught by the map.
export default function HeroMap({ points }: { points: HeroPoint[] }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!el.current) return;
    // On wide screens the city sits right of the headline.
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    const m = L.map(el.current, {
      preferCanvas: true,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      attributionControl: true,
    }).setView([38.635, wide ? -90.4 : -90.25], wide ? 12 : 11);
    m.attributionControl.setPosition("bottomright").setPrefix(false);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      className: "radar-tiles",
    }).addTo(m);

    const color = CATEGORY_COLOR.dumping;
    const maxReports = Math.max(1, ...points.map((p) => p[3]));
    const sorted = [...points].sort((a, b) => a[2] - b[2]);
    for (const [lat, lon, score, reports] of sorted.slice(0, -PULSE_TOP)) {
      L.circleMarker([lat, lon], {
        radius: 3 + 9 * Math.sqrt(reports / maxReports),
        stroke: false,
        fillColor: color,
        fillOpacity: 0.25 + 0.6 * (score / 100),
        interactive: false,
      }).addTo(m);
    }
    for (const [lat, lon, , reports] of sorted.slice(-PULSE_TOP)) {
      const d = Math.round(2 * (3 + 9 * Math.sqrt(reports / maxReports)));
      L.marker([lat, lon], {
        icon: L.divIcon({ className: "", html: `<span class="radar-top" style="--c:${color};width:${d}px;height:${d}px"></span>`, iconSize: [d, d] }),
        interactive: false,
        keyboard: false,
      }).addTo(m);
    }
    return () => {
      m.remove();
    };
  }, [points]);

  return <div ref={el} aria-hidden className="h-full w-full bg-[#0e0f11]" />;
}
