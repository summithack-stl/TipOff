"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

// Chrome and Edge fire this instead of showing their own install button; Safari never does.
// Not in lib.dom yet, so it is declared here rather than silenced.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Safari's pre-standard flag for "launched from the home screen".
type IosNavigator = Navigator & { standalone?: boolean };

export type InstallState = {
  /** The browser offered an install prompt we can trigger. */
  canPrompt: boolean;
  /** Already running from the home screen, so there is nothing to install. */
  installed: boolean;
  /** iOS has no prompt API: the user has to use Share -> Add to Home Screen. */
  ios: boolean;
  /** Shows the browser's install dialog. Resolves true if the user accepted. */
  install: () => Promise<boolean>;
};

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as IosNavigator).standalone === true;
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ reports as a Mac, so check for a touch screen as well.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// Stable module-level subscribers, so useSyncExternalStore does not resubscribe on every render.
function subscribeDisplayMode(onChange: () => void): () => void {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// The platform never changes under us, so there is nothing to subscribe to.
const noSubscribe = () => () => {};

// Server-rendered HTML can't know either of these; the first client render corrects them.
const notOnServer = () => false;

export function useInstallPrompt(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  // "appinstalled" fires while this tab is still the browser's, so display-mode stays "browser".
  const [justInstalled, setJustInstalled] = useState(false);

  const standalone = useSyncExternalStore(subscribeDisplayMode, isStandalone, notOnServer);
  const ios = useSyncExternalStore(noSubscribe, isIos, notOnServer);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // keep the event so our own button can fire it later
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setJustInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null); // the event is single-use, whatever the user chose
    return outcome === "accepted";
  }, [deferred]);

  return { canPrompt: deferred !== null, installed: standalone || justInstalled, ios, install };
}
