import { NextResponse } from "next/server";
import { z } from "zod";
import { detectFrame } from "@/lib/detect";

const MAX_BYTES = 5 * 1024 * 1024;

const fieldsSchema = z.object({
  camera_id: z.string().min(1).max(100),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  captured_at: z.string().datetime().optional(),
  confirm: z.enum(["0", "1"]).default("1"),
  precise: z.enum(["0", "1"]).default("0"),
});

// One camera frame in, detections out. Connector and replay script both post here.
// Live mode sends confirm=0 to skip the slow second model; hero shots send precise=1 for tighter boxes.
export async function POST(request: Request) {
  const start = Date.now();
  const form = await request.formData();

  const image = form.get("image");
  if (!(image instanceof File) || !image.type.startsWith("image/")) {
    return NextResponse.json({ error: "image file is required" }, { status: 400 });
  }
  if (image.size > MAX_BYTES) {
    return NextResponse.json({ error: "image is over 5 MB" }, { status: 413 });
  }

  const fields = fieldsSchema.safeParse({
    camera_id: form.get("camera_id") ?? undefined,
    lat: form.get("lat") ?? undefined,
    lon: form.get("lon") ?? undefined,
    captured_at: form.get("captured_at") ?? undefined,
    confirm: form.get("confirm") ?? undefined,
    precise: form.get("precise") ?? undefined,
  });
  if (!fields.success) {
    return NextResponse.json({ error: z.prettifyError(fields.error) }, { status: 400 });
  }

  const dataUrl = `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;

  try {
    const detections = await detectFrame(dataUrl, {
      confirm: fields.data.confirm === "1",
      precise: fields.data.precise === "1",
    });
    return NextResponse.json({ ...fields.data, detections, ms: Date.now() - start });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message, ms: Date.now() - start }, { status: 502 });
  }
}
