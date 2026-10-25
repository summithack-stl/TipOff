"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CATEGORY_LABEL, HOTSPOT_VAR } from "@/lib/categories";
import { HOTSPOT_CATEGORIES, type HotspotCategory } from "@/lib/hotspots";

// One hotspot type at a time, used by the map and the crew board.
export function TypeToggle({ value, onChange }: { value: HotspotCategory; onChange: (c: HotspotCategory) => void }) {
  return (
    <ToggleGroup
      aria-label="Hotspot type"
      variant="outline"
      size="sm"
      spacing={0}
      value={[value]}
      onValueChange={(v) => {
        const next = v[0] as HotspotCategory | undefined;
        if (next) onChange(next); // clicking the active type again keeps it
      }}
    >
      {HOTSPOT_CATEGORIES.map((c) => (
        <ToggleGroupItem
          key={c}
          value={c}
          className="gap-1.5 px-3 font-heading text-sm font-semibold tracking-wide uppercase aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:hover:bg-foreground/90"
        >
          <span className="size-2 rounded-full" style={{ background: HOTSPOT_VAR[c] }} />
          {CATEGORY_LABEL[c]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
