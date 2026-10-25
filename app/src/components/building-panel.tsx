"use client";

import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import type { Building } from "@/lib/buildings";
import { Drawer } from "@/components/drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackerOverlay } from "@/components/tracker-overlay";
import { friendlyError } from "@/lib/api-error";
import { loadPhotos, type Photo } from "@/lib/photos";
import { riskColor } from "@/lib/risk";

type Brief = { headline: string; hazards: string[]; crew_notes: string[] };

// ponytail: status is local only until the Supabase tickets table is wired in.
const STATUSES = ["open", "inspected", "boarded up"] as const;

export function BuildingPanel({ handle, onClose }: { handle: string; onClose: () => void }) {
  const [building, setBuilding] = useState<Building | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [error, setError] = useState("");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefState, setBriefState] = useState<"idle" | "loading" | "error">("idle");
  const [briefError, setBriefError] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("open");

  useEffect(() => {
    fetch(`/api/buildings/${handle}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Building not found"))))
      .then(setBuilding)
      .catch((e: Error) => setError(e.message));
    loadPhotos().then((all) => setPhoto(all.find((p) => p.handle === handle) ?? null));
  }, [handle]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const detections = photo?.after.detections ?? [];

  const writeBrief = async () => {
    setBriefState("loading");
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, detections: detections.map(({ category, severity, note }) => ({ category, severity, note })) }),
      });
      if (!res.ok) throw new Error(await friendlyError(res));
      setBrief(await res.json());
      setBriefState("idle");
    } catch (e) {
      setBriefError(e instanceof Error ? e.message : String(e));
      setBriefState("error");
    }
  };

  return (
    <Drawer label="Building details">
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div>
          <h2 className="font-heading text-2xl leading-tight font-bold uppercase">{building?.address ?? (error || "Loading…")}</h2>
          {building && (
            <p className="text-sm text-muted-foreground">
              Ward {building.ward ?? "?"} · Rank {building.risk_rank.toLocaleString()} of 9,884
              {building.year_built ? ` · Built ${building.year_built}` : ""}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
          <XIcon />
        </Button>
      </div>

      {/* Risk number caps at the red stop: the deepest reds fail contrast on the dark panel. */}
      {!building && !error && <Skeleton className="m-4 h-40" />}
      {building && (
        <div className="flex flex-col gap-5 p-4">
          <section className="flex items-center gap-4">
            <div className="text-6xl leading-none font-bold tabular-nums" style={{ color: riskColor(Math.min(building.risk_score, 72)) }}>
              {building.risk_score}
            </div>
            <div className="text-sm">
              <div className="font-medium">Risk score / 100</div>
              <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                {building.risk_reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Street photo</h3>
            {photo ? (
              <>
                <TrackerOverlay keyframes={[{ t: 0, image: `/photos/${photo.after.file}`, detections }]} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {photo.after.year} · {detections.length} hazard{detections.length === 1 ? "" : "s"} flagged · {photo.attribution}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No recent street photo near this building.</p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Firefighter brief</h3>
            {brief ? (
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <p className="font-medium">{brief.headline}</p>
                <ul className="list-disc pl-4">
                  {brief.hazards.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                <ul className="list-disc pl-4 text-muted-foreground">
                  {brief.crew_notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : briefState === "loading" ? (
              <Skeleton className="h-24" />
            ) : (
              <div className="flex flex-col items-start gap-2">
                <Button onClick={writeBrief}>{briefState === "error" ? "Try again" : "Write brief"}</Button>
                {briefState === "error" && <p className="text-sm text-destructive">{briefError}</p>}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Status</h3>
            <div className="flex gap-2" role="group" aria-label="Building status">
              {STATUSES.map((s) => (
                <Button key={s} size="sm" variant={status === s ? "default" : "outline"} aria-pressed={status === s} onClick={() => setStatus(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}
