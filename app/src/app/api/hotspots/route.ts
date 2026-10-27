import { NextResponse } from "next/server";
import { mapHotspots } from "@/lib/hotspot-store";

// The slim rows, serialized once and reused. "use cache" has to wrap the data, not the Response:
// a Response can't cross the cache boundary. `export const dynamic` is not an option either,
// since nextConfig.cacheComponents rejects it.
async function cachedRows(): Promise<string> {
  "use cache";
  return JSON.stringify(await mapHotspots());
}

// Every hotspot the map draws, slim. Built once from data/clean and cached, so it is a static
// response on the CDN rather than 2.5 MB inlined into the /map HTML on every request.
export async function GET() {
  return new NextResponse(await cachedRows(), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // The nightly refresh no longer redeploys, so the CDN copy must expire on its own: an hour at
      // most behind a new run. stale-while-revalidate keeps a crew on bad signal from waiting.
      "cache-control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
