"use client";

import { useEffect, useSyncExternalStore } from "react";

// Stable module-level subscriber, so useSyncExternalStore does not resubscribe on every render.
function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const readOnline = () => navigator.onLine;

// The server has no idea, and a crew with signal should never see the banner flash on load.
const assumeOnline = () => true;

/**
 * Whether the browser thinks it has a connection. navigator.onLine only knows about the network
 * interface, not whether anything is reachable, so treat it as a hint: the service worker still
 * serves the cached copy when a request actually fails.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, readOnline, assumeOnline);
}

/** Registers public/sw.js once the page has settled, so it never competes with the first paint. */
export function useServiceWorker(): void {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      // A failed registration must not break the page: offline support is a bonus, not a dependency.
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.warn("service worker not registered:", error instanceof Error ? error.message : error);
      });
    };
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);
}

/**
 * Mirrors the offline state onto <html data-offline>, so CSS can shorten --app-height by the
 * banner's height. Without this the full-height map overflows by exactly one banner when a crew
 * loses signal.
 */
export function useOfflineFlag(online: boolean): void {
  useEffect(() => {
    document.documentElement.dataset.offline = String(!online);
    return () => {
      delete document.documentElement.dataset.offline;
    };
  }, [online]);
}
