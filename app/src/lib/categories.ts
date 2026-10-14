import type { Category } from "@/lib/issues";

// One color per category, used by the tracker overlay, map pins and legends.
// Street issues are cool/bright; building hazards are warm and alarming. Sarthak owns the final hex codes.
export const CATEGORY_COLOR: Record<Category, string> = {
  pothole: "#f5b301", // amber
  graffiti: "#e040fb", // magenta
  dumping: "#a3e635", // lime
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
