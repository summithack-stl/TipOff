import { z } from "zod";

export const CATEGORIES = ["graffiti", "pothole", "dumping", "streetlight_out"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Severity = "low" | "medium" | "high";
export type Box = { x: number; y: number; w: number; h: number };
export type Point = { lat: number; lon: number };

// ponytail: placeholder names until Arjun posts the exact CSB problem codes from the 311 data.
export const DEPARTMENT: Record<Category, string> = {
  pothole: "Street Department: pothole repair",
  graffiti: "Graffiti removal",
  dumping: "Refuse: illegal dumping",
  streetlight_out: "Street lighting",
};

// What the vision models return. box_2d is [ymin, xmin, ymax, xmax] on a 0-1000 grid.
export const visionResultSchema = z.object({
  detections: z.array(
    z.object({
      category: z.enum(CATEGORIES),
      box_2d: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      confidence: z.number().min(0).max(1),
      severity: z.enum(["low", "medium", "high"]).default("medium"),
      note: z.string().default(""),
    }),
  ),
});
export type VisionDetection = z.infer<typeof visionResultSchema>["detections"][number];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round = (n: number) => Math.round(n * 1000) / 1000;

export function toBox([y1, x1, y2, x2]: [number, number, number, number]): Box {
  const left = clamp01(Math.min(x1, x2) / 1000);
  const top = clamp01(Math.min(y1, y2) / 1000);
  const right = clamp01(Math.max(x1, x2) / 1000);
  const bottom = clamp01(Math.max(y1, y2) / 1000);
  return { x: round(left), y: round(top), w: round(right - left), h: round(bottom - top) };
}

// Second model checks anything the fast model is unsure about, and anything severe.
export function needsConfirm(d: { confidence: number; severity: Severity }): boolean {
  return d.confidence < 0.8 || d.severity === "high";
}

export function distanceMeters(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

type TicketLike = Point & { id: string; category: string; status: string };

// Same issue = same category, still open, within 30 m.
export function findDuplicate<T extends TicketLike>(tickets: T[], d: Point & { category: string }): T | undefined {
  return tickets.find(
    (t) =>
      t.category === d.category &&
      (t.status === "open" || t.status === "in_progress") &&
      distanceMeters(t, d) <= 30,
  );
}

export function iou(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  const inter = w * h;
  return inter / (a.w * a.h + b.w * b.h - inter);
}

// Carry ids across keyframes so the overlay can glide a box instead of redrawing it.
// ponytail: greedy IoU match, fine at a few boxes per frame; Hungarian matching if frames get crowded.
export function assignIds<T extends { category: string; box: Box }>(
  prev: { id: string; category: string; box: Box }[],
  next: T[],
  counter: { n: number },
): (T & { id: string })[] {
  const used = new Set<string>();
  return next.map((d) => {
    let best: { id: string; score: number } | undefined;
    for (const p of prev) {
      if (p.category !== d.category || used.has(p.id)) continue;
      const score = iou(p.box, d.box);
      if (score > 0.2 && (!best || score > best.score)) best = { id: p.id, score };
    }
    if (best) {
      used.add(best.id);
      return { ...d, id: best.id };
    }
    counter.n += 1;
    return { ...d, id: `d_${String(counter.n).padStart(3, "0")}` };
  });
}

// Models sometimes report the same thing twice in one frame. Keep the most confident copy.
export function dropOverlaps<T extends { category: string; confidence: number; box: Box }>(detections: T[]): T[] {
  const kept: T[] = [];
  for (const d of [...detections].sort((a, b) => b.confidence - a.confidence)) {
    if (!kept.some((k) => k.category === d.category && iou(k.box, d.box) > 0.7)) kept.push(d);
  }
  return kept;
}
