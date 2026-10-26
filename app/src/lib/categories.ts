import type { Category } from "@/lib/issues";

// One color per category, used by the tracker overlay, map pins and legends.
// The three hotspot types match the --cat-* tokens in globals.css (dark-theme values, since the map and photos are dark).
// Building hazards are warm and alarming.
export const CATEGORY_COLOR: Record<Category, string> = {
  pothole: "#3ab0f5", // sky
  graffiti: "#b48cff", // violet
  dumping: "#ff6a2b", // TipOff orange
  streetlight_out: "#22d3ee", // cyan
  broken_curb: "#94a3b8", // slate
  sidewalk_damage: "#60a5fa", // blue
  open_entry: "#ff3b30", // red
  roof_damage: "#ff9f0a", // orange
  wall_damage: "#ff6a13", // deep orange
  fire_damage: "#e0115f", // crimson
};

export const CATEGORY_LABEL: Record<Category, string> = {
  pothole: "Pothole",
  graffiti: "Graffiti",
  dumping: "Dumping",
  streetlight_out: "Light out",
  broken_curb: "Broken curb",
  sidewalk_damage: "Sidewalk damage",
  open_entry: "Open entry",
  roof_damage: "Roof damage",
  wall_damage: "Wall damage",
  fire_damage: "Fire damage",
};

// Theme-aware version of the hotspot colors for page UI (switches with light and dark).
export const HOTSPOT_VAR = {
  dumping: "var(--cat-dumping)",
  pothole: "var(--cat-pothole)",
  graffiti: "var(--cat-graffiti)",
} as const;
