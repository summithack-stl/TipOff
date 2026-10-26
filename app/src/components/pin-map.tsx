"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Small map for setting where a photo was taken: tap to move the pin.
export default function PinMap({ at, onPick }: { at: { lat: number; lon: number }; onPick: (lat: number, lon: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.CircleMarker | null>(null);
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false }).setView([at.lat, at.lon], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
    pin.current = L.circleMarker([at.lat, at.lon], { radius: 10, color: "#fff", weight: 3, fillColor: "#e2480e", fillOpacity: 1 }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => pick.current(e.latlng.lat, e.latlng.lng));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // Created once; the effect below moves the pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    pin.current?.setLatLng([at.lat, at.lon]);
    map.current?.panTo([at.lat, at.lon]);
  }, [at.lat, at.lon]);

  return <div ref={el} className="h-64 w-full overflow-hidden rounded-lg border" />;
}
