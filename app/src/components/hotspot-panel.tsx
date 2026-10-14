"use client";

import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackerOverlay } from "@/components/tracker-overlay";
import { friendlyError } from "@/lib/api-error";
import { CATEGORY_COLOR, CATEGORY_LABEL } from "@/lib/categories";
import type { Hotspot } from "@/lib/hotspots";
import { nearestPhoto, type Photo } from "@/lib/photos";
import { riskColor } from "@/lib/risk";

const PHOTO_RADIUS_M = 300;

// Shape of POST /api/plan (Prahlad, Task 4).
type Plan = { id: string; headline: string; what_we_know: string[]; watch: string[]; actions: string[]; evidence: string[] };
const PLAN_SECTIONS = [
  ["what_we_know", "What we know"],
  ["watch", "Where and when to watch"],
  ["actions", "Actions"],
  ["evidence", "Evidence"],
] as const;

// Monthly 311 reports as thin bars. One series, so no legend: the heading names it.
function Timeline({ months, color }: { months: Hotspot["monthly"]; color: string }) {
  const max = Math.max(1, ...months.map((m) => m.count));
  const W = 360;
  const H = 72;
  const step = W / months.length;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" role="img" aria-label={`Monthly 311 reports, peak ${max} in one month`}>
        <line x1={0} x2={W} y1={H} y2={H} className="stroke-border" />
        {months.map((m, i) => {
          const h = Math.max(1, (m.count / max) * (H - 4));
          return (
            <g key={m.month} className="group">
              {/* Hit target is the full column, wider than the bar. */}
              <rect x={i * step} y={0} width={step} height={H} fill="transparent" />
              <rect x={i * step + 1} y={H - h} width={step - 2} height={h} rx={2} fill={color} className="opacity-80 group-hover:opacity-100" />
              <title>{`${m.month}: ${m.count} reports`}</title>
            </g>
          );
        })}
        <text x={0} y={H + 13} className="fill-muted-foreground text-[10px]">{months[0]?.month}</text>
        <text x={W} y={H + 13} textAnchor="end" className="fill-muted-foreground text-[10px]">{months.at(-1)?.month}</text>
      </svg>
    </figure>
  );
}

export function HotspotPanel({ hotspot: h, onClose }: { hotspot: Hotspot; onClose: () => void }) {
  const [near, setNear] = useState<{ photo: Photo; meters: number; exact: boolean } | null | undefined>(undefined);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planState, setPlanState] = useState<"idle" | "loading" | "error">("idle");
  const [planError, setPlanError] = useState("");

  useEffect(() => {
    nearestPhoto(h.lat, h.lon, PHOTO_RADIUS_M, h.id).then(setNear);
  }, [h.lat, h.lon, h.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const detections = near?.photo.after.detections ?? [];
  const trendPct = Math.round(h.trend * 100);

  const writePlan = async () => {
    setPlanState("loading");
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: h.id,
          detections: detections.map(({ category, severity, note }) => ({ category, severity, note })),
        }),
      });
      if (!res.ok) throw new Error(await friendlyError(res));
      setPlan(await res.json());
      setPlanState("idle");
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : String(e));
      setPlanState("error");
    }
  };

  const stat = (label: string, value: string) => (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );

  return (
    <aside
      aria-label="Hotspot details"
      className="absolute inset-y-0 right-0 z-[1001] flex w-[420px] max-w-full flex-col overflow-y-auto border-l bg-background/95 shadow-2xl backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="size-3 rounded-full" style={{ background: CATEGORY_COLOR[h.category] }} />
            {h.top_address || `${CATEGORY_LABEL[h.category]} hotspot`}
          </h2>
          <p className="text-sm text-muted-foreground">
            #{h.rank} of {CATEGORY_LABEL[h.category].toLowerCase()} hotspots · Ward {h.ward ?? "?"}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
          <XIcon />
        </Button>
      </div>

      <div className="flex flex-col gap-5 p-4">
        <section className="flex items-center gap-5">
          {/* Number caps at the red stop: the deepest reds fail contrast on the dark panel. */}
          <div className="text-center">
            <div className="text-6xl leading-none font-bold tabular-nums" style={{ color: riskColor(Math.min(h.score, 72)) }}>
              {h.score}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">score / 100</div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3 text-sm">
            {stat("311 reports", h.report_count.toLocaleString())}
            {stat("Trend, last 12 mo", `${trendPct > 0 ? "↑" : trendPct < 0 ? "↓" : "→"} ${Math.abs(trendPct)}%`)}
            {stat("Most reports on", h.peak_day)}
            {/* 311 times are when people report, not when dumping happens. */}
            {stat("Reports mostly come in", h.report_window)}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium">Why it&apos;s flagged</h3>
          <ul className="list-disc space-y-1 pl-4 text-sm">
            {h.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium">311 reports per month</h3>
          <Timeline months={h.monthly} color={CATEGORY_COLOR[h.category]} />
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium">Latest reports</h3>
          <ul className="divide-y text-sm">
            {h.recent.slice(0, 5).map((r, i) => (
              <li key={i} className="flex justify-between gap-3 py-1.5">
                <span className="truncate">{r.address}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{r.opened}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium">{near?.exact ? "Street photo at this hotspot" : "Nearest street photo"}</h3>
          {near === undefined ? (
            <Skeleton className="aspect-video" />
          ) : near ? (
            <>
              <TrackerOverlay keyframes={[{ t: 0, image: `/photos/${near.photo.after.file}`, detections }]} />
              <p className="mt-1 text-xs text-muted-foreground">
                {Math.round(near.meters)} m away · {near.photo.after.year} · {detections.length} issue{detections.length === 1 ? "" : "s"} flagged ·{" "}
                {near.photo.attribution}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No street photo within {PHOTO_RADIUS_M} m yet.</p>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium">Plan</h3>
          {plan ? (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <p className="font-medium">{plan.headline}</p>
              {PLAN_SECTIONS.map(([key, title]) =>
                plan[key]?.length ? (
                  <div key={key}>
                    <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
                    <ul className={`list-disc pl-4 ${key === "evidence" ? "text-muted-foreground" : ""}`}>
                      {plan[key].map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          ) : planState === "loading" ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="flex flex-col items-start gap-2">
              <Button onClick={writePlan}>{planState === "error" ? "Try again" : "Write plan"}</Button>
              {planState === "error" && <p className="text-sm text-destructive">{planError}</p>}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
