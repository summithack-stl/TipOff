"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Day } from "@/lib/crew";

const WEEK: readonly Day[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The weekday on this phone, right now. */
const deviceDay = (): Day => WEEK[new Date().getDay()];

/**
 * Fires once at the next local midnight, then re-arms. Without this, a crew who leaves the app open
 * overnight still sees yesterday labelled "(today)" — the page was rendered on the server hours ago.
 */
function subscribeMidnight(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const arm = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    // A second past midnight, so the new date has definitely turned over.
    timer = setTimeout(() => {
      onChange();
      arm();
    }, midnight.getTime() - now.getTime() + 1000);
  };
  arm();
  return () => clearTimeout(timer);
}

/**
 * The device's own weekday, falling back to what the server rendered.
 *
 * The server picks St. Louis time, which is right for a city crew but is decided when the page is
 * rendered and cached. This corrects it on the phone and keeps correcting it across midnight.
 */
export function useDeviceDay(serverDay: Day): Day {
  const fallback = useCallback(() => serverDay, [serverDay]);
  return useSyncExternalStore(subscribeMidnight, deviceDay, fallback);
}
