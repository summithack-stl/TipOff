import { NextResponse } from "next/server";
import { z } from "zod";
import { getBuilding } from "@/lib/buildings";
import { CATEGORIES } from "@/lib/issues";
import { chatJSON } from "@/lib/llm";

const requestSchema = z.object({
  handle: z.string().regex(/^\d{11}$/),
  // What the vision model saw on the latest photo, if any.
  detections: z
    .array(z.object({ category: z.enum(CATEGORIES), severity: z.enum(["low", "medium", "high"]), note: z.string().max(200) }))
    .max(30)
    .default([]),
});

const briefSchema = z.object({
  headline: z.string(),
  hazards: z.array(z.string()).max(6),
  crew_notes: z.array(z.string()).max(5),
});

const SYSTEM = `You write short pre-incident briefs about vacant buildings for St. Louis firefighters and building inspectors.
Use ONLY the facts given. Never invent measurements, occupants, history or structural conclusions.
This is not a structural assessment: phrase photo findings as "photo shows" and city records as "city records show".
Plain words, no jargon. Return JSON only:
{"headline":"one line, under 15 words","hazards":["up to 6 short bullet strings"],"crew_notes":["up to 5 short practical notes, e.g. what to check before entry"]}`;

// Building record + latest photo findings in, a short firefighter/inspector brief out.
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const building = getBuilding(parsed.data.handle);
  if (!building) {
    return NextResponse.json({ error: "unknown building handle" }, { status: 404 });
  }

  const facts = {
    address: building.address,
    ward: building.ward,
    year_built: building.year_built,
    on_vacant_list_since: building.vacant_since,
    months_on_vacant_list: building.months_vacant,
    major_code_violations: building.major_violations,
    minor_code_violations: building.minor_violations,
    recent_311_complaints: building.complaints_311,
    city_owned: building.lra_owned,
    inspection_priority_score: `${building.risk_score}/100 (rank ${building.risk_rank} of ~9,900)`,
    photo_findings: parsed.data.detections,
  };

  try {
    const brief = await chatJSON(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(facts) },
      ],
      briefSchema,
    );
    return NextResponse.json({ handle: building.handle, ...brief });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
