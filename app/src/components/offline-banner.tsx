"use client";

import { useOfflineFlag, useOnline, useServiceWorker } from "@/lib/offline";

// UI: Sarthak — smallest functional version. Logic lives in @/lib/offline.
// Mounted once in the root layout: it registers the service worker and says when the phone is cut off.
export function OfflineBanner() {
  useServiceWorker();
  const online = useOnline();
  useOfflineFlag(online);

  if (online) return null;

  return (
    <div
      role="status"
      className="flex h-[var(--offline-bar)] shrink-0 items-center justify-center border-b border-amber-500/40 bg-amber-500/15 px-4 text-center text-xs text-amber-200"
    >
      No signal. Showing the hotspots and plans already on this phone.
    </div>
  );
}
