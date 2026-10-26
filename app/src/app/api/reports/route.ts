import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { detectFrame, type Detection } from "@/lib/detect";
import { cellOf, fieldHotspots, inStLouis, MIN_REPORTS, type FieldReport } from "@/lib/field-reports";
import { dumping311PerCell, listReports, saveReport, storeConfigured } from "@/lib/field-store";
import { clientKey, rateLimit, upstreamError } from "@/lib/guard";
import { loadHotspots } from "@/lib/hotspot-data";
import type { Hotspot } from "@/lib/hotspots";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel rejects bodies over 4.5 MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MIN_CONFIDENCE = 0.5;
export const maxDuration = 60;

const fieldsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

// Key for the reporter hash. An HMAC with a secret key can't be brute-forced back to an IP the way a plain
// salted hash of the small IPv4 space can. REPORT_SALT if set; else the Blob token, which is already a secret
// on Vercel; else (local dev only) a random key for this process.
const REPORTER_KEY = process.env.REPORT_SALT || process.env.BLOB_READ_WRITE_TOKEN || randomBytes(32).toString("hex");
const reporterOf = (request: Request) => createHmac("sha256", REPORTER_KEY).update(clientKey(request)).digest("hex").slice(0, 24);

let byId: Map<string, Hotspot> | null = null;
const existing = () => (byId ??= new Map(loadHotspots().hotspots.filter((h) => h.category === "dumping").map((h) => [h.id, h])));

// What the map needs: only the hotspots photo reports changed or created, at block level.
// Individual reports (exact place, time, photo) never leave the server.
export async function GET(request: Request) {
  const limited = rateLimit(request, "reports-read", 60);
  if (limited) return limited;
  try {
    return NextResponse.json({ hotspots: fieldHotspots(await listReports(), existing(), dumping311PerCell()) });
  } catch (error) {
    return upstreamError("reports", error);
  }
}

// One phone photo in. It is kept only if the photo check finds dumping and the place is in St. Louis.
export async function POST(request: Request) {
  const limited = rateLimit(request, "reports", 6);
  if (limited) return limited;
  if (!storeConfigured()) {
    return NextResponse.json({ error: "Report storage isn't set up on this deployment yet." }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "send multipart/form-data" }, { status: 400 });
  const image = form.get("image");
  if (!(image instanceof File) || !IMAGE_TYPES.includes(image.type)) {
    return NextResponse.json({ error: "Attach a JPEG, PNG or WebP photo." }, { status: 400 });
  }
  if (image.size > MAX_BYTES) return NextResponse.json({ error: "That photo is over 4 MB." }, { status: 413 });
  const fields = fieldsSchema.safeParse({ lat: form.get("lat") ?? undefined, lon: form.get("lon") ?? undefined });
  if (!fields.success) return NextResponse.json({ error: "Set where the photo was taken." }, { status: 400 });
  const { lat, lon } = fields.data;
  if (!inStLouis(lat, lon)) {
    return NextResponse.json({ error: "TipOff only takes reports inside the City of St. Louis. Move the pin to where the photo was taken." }, { status: 422 });
  }

  const bytes = await image.arrayBuffer();
  const photoHash = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
  if ((await listReports()).some((r) => r.photoHash === photoHash)) {
    return NextResponse.json({ error: "This photo has already been reported. Thanks!" }, { status: 409 });
  }
  const dataUrl = `data:${image.type};base64,${Buffer.from(bytes).toString("base64")}`;
  const bestDumping = (ds: Detection[]) => ds.filter((d) => d.category === "dumping" && d.confidence >= MIN_CONFIDENCE).sort((a, b) => b.confidence - a.confidence)[0];
  let detections: Detection[];
  let dumping: Detection | undefined;
  try {
    detections = await detectFrame(dataUrl, { confirm: true });
    dumping = bestDumping(detections);
    // The fast pass misses dumping now and then (1 run in 3 on the same photo, measured), so before turning
    // a reporter away, look once more with the whole photo on the second model.
    if (!dumping) {
      detections = await detectFrame(dataUrl, { confirm: true, precise: true });
      dumping = bestDumping(detections);
    }
  } catch (error) {
    return upstreamError("reports", error);
  }
  if (!dumping) {
    return NextResponse.json(
      { error: "The photo check didn't find dumping in this photo, so it wasn't saved. Try a closer, well-lit shot of the pile.", detections },
      { status: 422 },
    );
  }

  const report: FieldReport = {
    id: `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`,
    lat: Math.round(lat * 1e5) / 1e5,
    lon: Math.round(lon * 1e5) / 1e5,
    at: new Date().toISOString(),
    confidence: Math.round(dumping.confidence * 100) / 100,
    note: dumping.note.slice(0, 200),
    photo: null,
    reporter: reporterOf(request),
    photoHash,
  };
  try {
    const saved = await saveReport(report, { bytes, type: image.type });
    const cell = cellOf(saved.lat, saved.lon);
    const all = await listReports();
    const hotspot = fieldHotspots(all, existing(), dumping311PerCell()).find((h) => h.id === `dumping-${cell}`) ?? null;
    const reporters = new Set(all.filter((r) => cellOf(r.lat, r.lon) === cell).map((r) => r.reporter || r.id)).size;
    const onBlock = (dumping311PerCell().get(cell)?.count ?? 0) + reporters;
    // The sender sees what was found, not the stored record (no photo URL, no reporter hash).
    return NextResponse.json(
      { report: { confidence: saved.confidence, note: saved.note }, hotspot, onBlock, needed: Math.max(0, MIN_REPORTS - onBlock) },
      { status: 201 },
    );
  } catch (error) {
    return upstreamError("reports", error);
  }
}
