import "server-only";

import { visionJSON } from "@/lib/llm";
import { dropOverlaps, iou, needsConfirm, toBox, visionResultSchema, type Box, type Category, type Severity, type VisionDetection } from "@/lib/issues";

export type Detection = {
  category: Category;
  box: Box;
  confidence: number;
  severity: Severity;
  note: string;
  confirmed: boolean;
};

const PROMPT = `You inspect street-camera frames for city maintenance issues.
Find every instance of:
- graffiti: spray paint or tags on walls, signs, poles (not commissioned murals)
- pothole: holes or broken pavement in the road surface
- dumping: piles of trash, bags, furniture, mattresses, tires, construction debris left outside
- streetlight_out: a street lamp that is visibly dark at night
Ignore people and vehicles entirely. Never describe people.
Return JSON only, no reasoning:
{"detections":[{"category":"graffiti|pothole|dumping|streetlight_out","box_2d":[ymin,xmin,ymax,xmax],"confidence":0.0-1.0,"severity":"low|medium|high","note":"under 10 words"}]}
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
export async function detectFrame(imageDataUrl: string, { confirm = true } = {}): Promise<Detection[]> {
  return dropOverlaps(await detectAll(imageDataUrl, confirm));
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
