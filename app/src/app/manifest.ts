import type { MetadataRoute } from "next";

// Makes TipOff installable from a phone browser. Crews open the app to today's list, not the
// landing page, so start_url is /crew.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TipOff — St. Louis dumping hotspots",
    short_name: "TipOff",
    description:
      "Ranked repeat illegal-dumping blocks from the City's 311 reports, with a camera and cleanup plan for each one.",
    start_url: "/crew",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    // Matches the app's dark theme: --background is oklch(0.145 0 0).
    theme_color: "#0a0a0a",
    background_color: "#0a0a0a",
    categories: ["government", "utilities", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today's crew list", short_name: "Crew", url: "/crew" },
      { name: "Hotspot map", short_name: "Map", url: "/map" },
    ],
  };
}
