"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CameraIcon, LocateFixedIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/api-error";
import { inStLouis, type FieldReport } from "@/lib/field-reports";
import type { Hotspot } from "@/lib/hotspots";

const PinMap = dynamic(() => import("@/components/pin-map"), { ssr: false, loading: () => <div className="h-64 w-full animate-pulse rounded-lg border bg-muted" /> });

const DOWNTOWN = { lat: 38.627, lon: -90.199 };
const MAX_SIDE = 1600;

// Phone photos are often 4-12 MB; shrink to fit the 4 MB upload limit and keep the photo check fast.
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * k);
  canvas.height = Math.round(img.height * k);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Couldn't read that photo."))), "image/jpeg", 0.85));
}

type Result = { report: FieldReport; hotspot: Hotspot | null; onBlock: number; needed: number };

// UI: Sarthak
export function ReportForm() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [at, setAt] = useState(DOWNTOWN);
  const [placed, setPlaced] = useState(false);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const pick = useCallback((lat: number, lon: number) => {
    setAt({ lat, lon });
    setPlaced(true);
    setError(null);
  }, []);

  const locate = () => {
    if (!navigator.geolocation) return setError("This browser can't share its location. Tap the map instead.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        if (!inStLouis(p.coords.latitude, p.coords.longitude)) {
          setError("You're outside the City of St. Louis. Tap the map where the photo was taken.");
          return;
        }
        pick(p.coords.latitude, p.coords.longitude);
      },
      () => {
        setLocating(false);
        setError("Location was blocked. Tap the map where the photo was taken.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const choose = (f: File | undefined) => {
    if (!f) return;
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError(null);
  };

  const send = async () => {
    if (!photo) return setError("Add a photo first.");
    if (!placed) return setError("Set where the photo was taken: use your location or tap the map.");
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("image", await shrink(photo), "report.jpg");
      body.set("lat", String(at.lat));
      body.set("lon", String(at.lon));
      const res = await fetch("/api/reports", { method: "POST", body });
      if (!res.ok) throw new Error(await friendlyError(res));
      setResult((await res.json()) as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the report.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const h = result.hotspot;
    return (
      <div className="space-y-4">
        <p className="font-heading text-3xl font-bold uppercase">Report saved</p>
        <p className="text-muted-foreground">
          The photo check found dumping ({Math.round(result.report.confidence * 100)}% sure): {result.report.note}
        </p>
        {h ? (
          <p className="rounded-lg border bg-card p-4">
            {h.source === "field" ? <strong className="text-hot">New hotspot. </strong> : <strong>Added to a known hotspot. </strong>}
            This block now has {result.onBlock} reports{h.field_reports ? `, ${h.field_reports} of them photos from TipOff` : ""}.
          </p>
        ) : (
          <p className="rounded-lg border bg-card p-4">
            This block has {result.onBlock} report{result.onBlock === 1 ? "" : "s"}. {result.needed} more and it becomes a hotspot.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {h ? (
            <Link href={`/map?h=${h.id}`} className="inline-flex h-9 items-center rounded-md bg-hot px-4 text-sm font-medium text-hot-foreground">
              See it on the map
            </Link>
          ) : null}
          <Button variant="outline" onClick={() => { setResult(null); setPhoto(null); setPreview(null); }}>
            Report another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-dashed bg-card p-6 text-center">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not an optimizable asset
          <img src={preview} alt="The photo you picked" className="max-h-72 rounded-md object-contain" />
        ) : (
          <>
            <CameraIcon className="size-8 text-hot" aria-hidden />
            <span className="font-heading text-lg font-semibold uppercase">Take or pick a photo of the dumping</span>
          </>
        )}
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
      </label>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-heading text-sm font-semibold tracking-wide text-muted-foreground uppercase">Where was it?</p>
          <Button variant="outline" size="sm" onClick={locate} disabled={locating}>
            <LocateFixedIcon aria-hidden /> {locating ? "Finding you…" : "Use my location"}
          </Button>
        </div>
        <PinMap at={at} onPick={pick} />
        <p className="text-xs text-muted-foreground">{placed ? `Pin at ${at.lat.toFixed(5)}, ${at.lon.toFixed(5)}. Tap the map to move it.` : "Tap the map where the photo was taken."}</p>
      </div>

      {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert">{error}</p> : null}

      <Button size="lg" className="w-full" onClick={send} disabled={busy}>
        {busy ? "Checking the photo…" : "Send report"}
      </Button>
      <p className="text-xs text-muted-foreground">
        The photo is checked for dumping before it&apos;s saved. Only photos that show dumping, taken inside the City of St. Louis, are kept. TipOff never looks for faces or license plates.
      </p>
    </div>
  );
}
