// Things a crew does standing on the block: get driving directions, and send it to a colleague.

/**
 * A directions link that opens the phone's own maps app.
 *
 * These are https URLs rather than the `maps://` and `geo:` schemes. On iOS, maps.apple.com opens
 * Apple Maps; on Android, a Google Maps URL opens the app. The schemes do the same thing but
 * cannot fail gracefully: a `geo:` link on a desktop, or on a phone with no maps app, leaves the
 * browser with nothing to open and no way to detect it. The https form is its own fallback.
 *
 * The caller passes the platform (from isIos()) rather than this file reading navigator, so the
 * whole module stays free of browser globals and node --test can load it.
 */
export function directionsUrl(lat: number, lon: number, ios: boolean, label?: string): string {
  const at = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  if (ios) {
    const name = label ? `&q=${encodeURIComponent(label)}` : "";
    return `https://maps.apple.com/?daddr=${at}&dirflg=d${name}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${at}`;
}

/** A link to one hotspot on the map, for sharing. Absolute, so it survives a paste anywhere. */
export function hotspotLink(id: string, origin?: string): string {
  const base = origin ?? (typeof window === "undefined" ? "" : window.location.origin);
  return `${base}/map?h=${encodeURIComponent(id)}`;
}

export type ShareResult = "shared" | "copied" | "failed";

/**
 * Hands a block to someone else: the Web Share sheet where there is one, the clipboard otherwise.
 * The caller shows the result, because "copied" needs saying and "shared" does not.
 */
export async function shareHotspot(title: string, url: string): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text: title, url });
      return "shared";
    } catch (error) {
      // The user closing the sheet is an AbortError, not a failure worth falling back from.
      if (error instanceof DOMException && error.name === "AbortError") return "shared";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
