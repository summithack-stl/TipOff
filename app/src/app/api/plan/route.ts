import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, upstreamError } from "@/lib/guard";
import { getHotspot } from "@/lib/hotspot-store";
import { CATEGORIES } from "@/lib/issues";
import { chatJSON } from "@/lib/llm";
import { planFacts } from "@/lib/plan";

const requestSchema = z.object({
  id: z.string().regex(/^(dumping|pothole|graffiti)-\d+_-?\d+$/),
  // What the vision model saw on the nearest street photo, if any.
  detections: z
    .array(z.object({ category: z.enum(CATEGORIES), severity: z.enum(["low", "medium", "high"]), note: z.string().max(200) }))
    .max(30)
    .default([]),
});

const planSchema = z.object({
  headline: z.string(),
  what_we_know: z.array(z.string()).max(5),
  watch: z.array(z.string()).max(3),
  actions: z.array(z.string()).max(5),
  evidence: z.array(z.string()).max(5),
});

const SYSTEM = `You write short action plans for St. Louis city staff about one repeat hotspot of illegal dumping, potholes or graffiti.
Use ONLY the facts given. Never invent dates, counts, people, vehicles or causes.
Never try to identify a person. No faces, no license plates, no names. Plans target places and times, not people.
Report times are when residents REPORTED the problem, not when it happened: say "reports mostly come in ...", never "dumping happens at ...".
Dumping happens BEFORE it is reported, so never tell staff to watch only during the report window: cameras should record around the clock, and drive-bys go the evening and night before the busiest report day.
Nearby vacant buildings are context, not a proven cause: never call them the source.
Phrase facts as "311 reports show" or "photo shows". Plain words, no jargon. Return JSON only:
{"headline":"one line, under 15 words",
 "what_we_know":["up to 5 sourced facts"],
 "watch":["up to 3: where to point a camera and when to schedule drive-bys"],
 "actions":["up to 5 practical steps: cleanup crew, signage, lighting, camera, notify owner of a vacant lot"],
 "evidence":["up to 5: what this site's report history and photos can support if the city pursues a citation"]}`;

export const maxDuration = 30;

// One hotspot + latest photo findings in, a short camera/cleanup plan out.
export async function POST(request: Request) {
  const limited = rateLimit(request, "plan", 20);
  if (limited) return limited;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const hotspot = getHotspot(parsed.data.id);
  if (!hotspot) {
    return NextResponse.json({ error: "unknown hotspot id" }, { status: 404 });
  }

  try {
    const plan = await chatJSON(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(planFacts(hotspot, parsed.data.detections)) },
      ],
      planSchema,
    );
    return NextResponse.json({ id: hotspot.id, ...plan });
  } catch (error) {
    return upstreamError("plan", error);
  }
}
