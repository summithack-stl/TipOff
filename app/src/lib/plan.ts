import type { Hotspot } from "@/lib/hotspots";

// Builds the fact sheet the LLM sees for one hotspot. Type-only import, so node:test can load this file.
export type PlanDetection = { category: string; severity: "low" | "medium" | "high"; note: string };

export function planFacts(h: Hotspot, detections: PlanDetection[]): Record<string, unknown> {
  return {
    issue_type: h.category,
    near_address: h.top_address,
    priority: `${h.score}/100 (#${h.rank} of ${h.category} hotspots)`,
    reports_last_12_months: h.reports_12m,
    reports_year_before: h.reports_prev_12m,
    weeks_with_reports_this_year: h.active_weeks_12m,
    most_reports_on: h.peak_day,
    reports_mostly_come_in: h.report_window,
    median_days_to_close: h.median_days_to_close,
    vacant_buildings_within_150m: h.vacant_within_150m,
    latest_reports: h.recent.slice(0, 5),
    photo_findings: detections,
  };
}
