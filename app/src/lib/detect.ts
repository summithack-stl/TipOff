import "server-only";

import { visionJSON } from "@/lib/llm";
import { capPerCategory, dropOverlaps, iou, needsConfirm, toBox, visionResultSchema, type Box, type Category, type Severity, type VisionDetection } from "@/lib/issues";

export type Detection = {
  category: Category;
  box: Box;
  confidence: number;
  severity: Severity;
  note: string;
  confirmed: boolean;
};

const PROMPT = `You inspect street-level photos of city blocks for a fire department and city maintenance crews.
Find every visible instance of:
Building hazards (vacant or damaged buildings):
- open_entry: a doorway or window on a building that is open, broken or missing boards, so a person could get in
- roof_damage: holes, missing sections, sagging or collapsed roof
- wall_damage: cracked, bowing, leaning or partly collapsed exterior walls, missing bricks
- fire_damage: scorch marks, charring or burned-out sections
Street issues:
- graffiti: spray paint or tags on walls, signs, poles (not commissioned murals)
- pothole: holes or broken pavement in the road surface
- dumping: piles of trash, bags, furniture, mattresses, tires, construction debris left outside
- streetlight_out: a street lamp that is visibly dark at night
- broken_curb: the raised concrete or stone edge between the road and the sidewalk or grass is crumbling, chipped,
  cracked through, missing chunks, or pushed up or out of line (often by tree roots or vehicles). Close-ups count.
- sidewalk_damage: sidewalk slabs or pavers that are heaved, sunken, badly cracked, broken up or missing (trip hazards)
Only report what is clearly visible. Boarded-up, bricked-up or otherwise sealed openings are NOT open_entry.
Report each distinct problem once; group a row of similar broken windows into one box instead of one box per window.
Building hazards only apply to buildings that look vacant, abandoned or damaged (missing or broken glass, missing doors,
overgrowth, collapse, charring). Normal doors, windows and storefronts on buildings in use are NOT hazards.
Ignore people and vehicles entirely. Never describe people.
Return JSON only, no reasoning:
{"detections":[{"category":"open_entry|roof_damage|wall_damage|fire_damage|graffiti|pothole|dumping|streetlight_out|broken_curb|sidewalk_damage","box_2d":[ymin,xmin,ymax,xmax],"confidence":0.0-1.0,"severity":"low|medium|high","note":"under 10 words"}]}
box_2d uses a 0-1000 grid. If nothing is found return {"detections":[]}.`;

const toDetection = (d: VisionDetection, confirmed: boolean): Detection => ({
  category: d.category,
  box: toBox(d.box_2d),
  confidence: d.confidence,
  severity: d.severity,
  note: d.note,
  confirmed,
});

// Fast model finds issues; the second model re-checks the unsure or severe ones.
// If the fast model is down or rate-limited, the second model does the whole frame.
// confirm: false skips the slow second model (live mode); unsure detections come back unconfirmed.
// precise: true sends the whole frame to the second model only. Slow, but its boxes are much tighter (hero shots).
export async function detectFrame(imageDataUrl: string, { confirm = true, precise = false } = {}): Promise<Detection[]> {
  const found = precise
    ? (await visionJSON(PROMPT, imageDataUrl, visionResultSchema, "CONFIRM")).detections.map((d) => toDetection(d, true))
    : await detectAll(imageDataUrl, confirm);
  return capPerCategory(dropOverlaps(found));
}

async function detectAll(imageDataUrl: string, confirm: boolean): Promise<Detection[]> {
  let fast: VisionDetection[];
  try {
    fast = (await visionJSON(PROMPT, imageDataUrl, visionResultSchema, "VISION")).detections;
  } catch (error) {
    console.warn("VISION pass failed, using CONFIRM for the whole frame:", error instanceof Error ? error.message : error);
    const slow = await visionJSON(PROMPT, imageDataUrl, visionResultSchema, "CONFIRM");
    return slow.detections.map((d) => toDetection(d, true));
  }

  if (!confirm || !fast.some(needsConfirm)) return fast.map((d) => toDetection(d, !needsConfirm(d)));

  let second: Detection[];
  try {
    second = (await visionJSON(PROMPT, imageDataUrl, visionResultSchema, "CONFIRM")).detections.map((d) =>
      toDetection(d, true),
    );
  } catch (error) {
    // Second opinion unavailable: keep the unsure ones but leave them unconfirmed (dashed on screen).
    console.warn("CONFIRM pass failed:", error instanceof Error ? error.message : error);
    return fast.map((d) => toDetection(d, !needsConfirm(d)));
  }

  const out: Detection[] = [];
  for (const d of fast) {
    const mine = toDetection(d, true);
    if (!needsConfirm(d)) {
      out.push(mine);
      continue;
    }
    // Confirmed when the second model saw the same kind of issue in roughly the same place.
    // Its box is usually tighter, so use it. Unmatched unsure detections are dropped as false alarms.
    const match = second.find((s) => s.category === d.category && iou(s.box, mine.box) > 0.1);
    if (match) out.push({ ...match, confidence: Math.max(match.confidence, d.confidence) });
  }
  return out;
}
