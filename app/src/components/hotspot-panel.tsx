"use client";

import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackerOverlay } from "@/components/tracker-overlay";
import { friendlyError } from "@/lib/api-error";
import { CATEGORY_LABEL, HOTSPOT_VAR } from "@/lib/categories";
import { parseWindow, reportLabel } from "@/lib/crew";
import { DAYS, type Hotspot } from "@/lib/hotspots";
import { useHotspot } from "@/lib/map-data";
import { nearestPhoto, type Photo } from "@/lib/photos";

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
              <rect x={i * step + 1} y={H - h} width={step - 2} height={h} rx={2} style={{ fill: color }} className="opacity-80 group-hover:opacity-100" />
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

// One bar per hour (or weekday); the busiest block is drawn in the type color.
function BarStrip({ values, labels, hot, color, name }: { values: number[]; labels: string[]; hot: (i: number) => boolean; color: string; name: string }) {
  const max = Math.max(1, ...values);
  return (
    <figure>
      <div className="flex h-14 items-end gap-0.5" role="img" aria-label={name}>
        {values.map((v, i) => (
          <span
            key={i}
            title={`${labels[i] || i}: ${v} reports`}
            className="flex-1 rounded-[2px]"
            style={{ height: `${Math.max(4, (v / max) * 100)}%`, background: hot(i) ? color : "var(--muted-foreground)", opacity: hot(i) ? 1 : 0.35 }}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 font-mono text-[10px] text-muted-foreground">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center">
            {l}
          </span>
        ))}
      </div>
    </figure>
  );
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => (h % 6 === 0 ? ["12a", "6a", "12p", "6p"][h / 6] : ""));

// The map holds only slim rows, so opening a hotspot fetches its detail. The crew board already has
// the whole hotspot from the server and passes it as `initial`, which renders with no request.
export function HotspotPanel({ id, initial, onClose }: { id: string; initial?: Hotspot; onClose: () => void }) {
  const detail = useHotspot(id, initial);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (detail.state === "ready") return <HotspotDetail hotspot={detail.hotspot} onClose={onClose} />;

  return (
    <Drawer label="Hotspot details">
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <h2 className="font-heading text-2xl leading-tight font-bold uppercase">
          {detail.state === "loading" ? "Loading…" : "Unavailable"}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
          <XIcon />
        </Button>
      </div>
      <div className="flex flex-col gap-5 p-4" aria-busy={detail.state === "loading"}>
        {detail.state === "loading" ? (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-24" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <p className="text-sm text-destructive">{detail.message}</p>
        )}
      </div>
    </Drawer>
  );
}

function HotspotDetail({ hotspot: h, onClose }: { hotspot: Hotspot; onClose: () => void }) {
  const [near, setNear] = useState<{ photo: Photo; meters: number; exact: boolean } | null | undefined>(undefined);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planState, setPlanState] = useState<"idle" | "loading" | "error">("idle");
  const [planError, setPlanError] = useState("");

  useEffect(() => {
    nearestPhoto(h.lat, h.lon, PHOTO_RADIUS_M, h.id).then(setNear);
  }, [h.lat, h.lon, h.id]);

  const detections = near?.photo.after.detections ?? [];
  const color = HOTSPOT_VAR[h.category];
  const win = parseWindow(h.report_window);
  const inWindow = (hr: number) => !!win && (win[0] <= win[1] ? hr >= win[0] && hr < (win[1] || 24) : hr >= win[0] || hr < win[1]);
  const peakDow = Math.max(...h.by_dow);
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

  const heading = "mb-2 font-heading text-sm font-semibold tracking-wide text-muted-foreground uppercase";
  const stat = (label: string, value: string) => (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );

  return (
    <Drawer label="Hotspot details">
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-2xl leading-tight font-bold uppercase">
            <span className="size-3 shrink-0 rounded-full" style={{ background: color }} />
            {h.top_address || `${CATEGORY_LABEL[h.category]} hotspot`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {h.source === "field" ? "New from photo reports" : `#${h.rank} of ${CATEGORY_LABEL[h.category].toLowerCase()} hotspots`} · Ward {h.ward ?? "?"}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
          <XIcon />
        </Button>
      </div>

      <div className="flex flex-col gap-5 p-4">
        <section className="flex items-center gap-5">
          <div className="text-center">
            <div className="font-mono text-6xl leading-none font-semibold tabular-nums" style={{ color }}>
              {h.score}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">score / 100</div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3 text-sm">
            {stat(h.field_reports ? "Reports (311 + photo)" : "311 reports", (h.report_count + (h.source === "field" ? 0 : h.field_reports ?? 0)).toLocaleString())}
            {/* With no reports the year before, a % is meaningless (0 → 7 reads as +700%). */}
            {stat(
              "Trend, last 12 mo",
              h.reports_prev_12m === 0 && h.reports_12m > 0 ? "New this year" : `${trendPct > 0 ? "↑" : trendPct < 0 ? "↓" : "→"} ${Math.abs(trendPct)}%`,
            )}
            {stat("Most reports on", h.peak_day)}
            {/* 311 times are when people report, not when dumping happens. */}
            {stat("Reports mostly come in", h.report_window)}
          </div>
        </section>

        <section>
          <h3 className={heading}>Why it&apos;s flagged</h3>
          <ul className="list-disc space-y-1 pl-4 text-sm">
            {h.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>

        <section>
          {/* 311 times are when people report, not when it happens. */}
          <h3 className={heading}>When reports come in</h3>
          <BarStrip values={h.by_hour} labels={HOUR_LABELS} hot={inWindow} color={color} name={`Reports by hour, busiest ${h.report_window}`} />
          <div className="mt-4">
            <BarStrip
              values={h.by_dow}
              labels={DAYS.map((d) => d[0])}
              hot={(i) => h.by_dow[i] === peakDow}
              color={color}
              name={`Reports by weekday, busiest ${h.peak_day}`}
            />
          </div>
        </section>

        <section>
          <h3 className={heading}>311 reports per month</h3>
          <Timeline months={h.monthly} color={color} />
        </section>

        <section>
          <h3 className={heading}>Latest reports</h3>
          <ul className="divide-y text-sm">
            {h.recent.slice(0, 5).map((r, i) => (
              <li key={i} className="flex justify-between gap-3 py-1.5">
                <span className="min-w-0">
                  <span className="block truncate">{r.address}</span>
                  <span className="block truncate text-xs text-muted-foreground">{reportLabel(r.code)}</span>
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{r.opened}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className={heading}>{near?.exact ? "Street photo at this hotspot" : "Nearest street photo"}</h3>
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
          <h3 className={heading}>Plan</h3>
          {plan ? (
            <article className="space-y-4 rounded-lg border bg-card p-4 text-sm">
              <p className="font-heading text-xl leading-tight font-bold uppercase">{plan.headline}</p>
              {PLAN_SECTIONS.map(([key, title]) =>
                plan[key]?.length ? (
                  <section key={key} className="border-t pt-3">
                    <h4 className="font-heading text-sm font-bold tracking-wide uppercase" style={{ color }}>
                      {title}
                    </h4>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {plan[key].map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </section>
                ) : null,
              )}
            </article>
          ) : planState === "loading" ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="flex flex-col items-start gap-2">
              <Button onClick={writePlan} size="lg" className="press bg-hot px-5 font-heading text-base font-semibold tracking-wide text-hot-foreground uppercase hover:bg-hot/85">
                {planState === "error" ? "Try again" : "Write plan"}
              </Button>
              {planState === "error" && <p className="text-sm text-destructive">{planError}</p>}
            </div>
          )}
        </section>
      </div>
    </Drawer>
  );
}
