import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/guard";
import { getHotspot } from "@/lib/hotspot-store";

// Full detail for one hotspot: the monthly history, recent reports and reasons the panel shows.
// Fetched on click, so none of it has to ship with the map.
const idSchema = z.string().regex(/^(dumping|pothole|graffiti)-\d+_-?\d+$/);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(_request, "hotspot", 120);
  if (limited) return limited;

  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) return NextResponse.json({ error: "bad hotspot id" }, { status: 400 });

  const hotspot = getHotspot(parsed.data);
  if (!hotspot) return NextResponse.json({ error: "unknown hotspot id" }, { status: 404 });

  // Immutable until the nightly rebuild redeploys, same as the slim list.
  return NextResponse.json(hotspot, {
    headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
