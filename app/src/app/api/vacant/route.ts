import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

// The vacant-building layer is off by default and 400 KB, so it used to be 400 KB of /map HTML
// nobody asked for. Served here instead and fetched only when a crew turns the layer on.
async function cachedRows(): Promise<string> {
  "use cache";
  const file = join(process.cwd(), "data/clean/vacant_buildings_lite.json");
  return existsSync(file) ? readFileSync(file, "utf8") : "[]";
}

export async function GET() {
  return new NextResponse(await cachedRows(), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
