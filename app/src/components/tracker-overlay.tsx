"use client";

import { useEffect, useRef, useState } from "react";
import type { Box, Category, Severity } from "@/lib/issues";
import { CATEGORY_COLOR, CATEGORY_LABEL } from "@/lib/categories";

export type Detection = {
  id?: string;
  category: Category;
  box: Box;
  confidence: number;
  severity: Severity;
  note: string;
  confirmed: boolean;
};
// Contract A keyframe. `image` set = still-photo mode (each photo is one keyframe).
export type Keyframe = { t: number; lat?: number; lon?: number; image?: string; detections: Detection[] };

type Props = {
  keyframes: Keyframe[];
  video?: string; // play a clip and sync boxes to video.currentTime
  loop?: boolean; // photo mode: start over after the last photo, else hold on it
  className?: string;
};

const DWELL = 6; // seconds each still photo stays up
const ZOOM = 0.12; // slow push-in over one photo
const FADE = 0.4;
const LOCK = 0.35; // brackets snap from loose to tight
const PULSE = 0.7; // confirmed ring after lock-on

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (u: number) => 1 - (1 - u) ** 3;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerpBox = (a: Box, b: Box, u: number): Box => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), w: lerp(a.w, b.w, u), h: lerp(a.h, b.h, u) });

type Rect = { x: number; y: number; w: number; h: number };

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// chips: label chips already drawn this frame, so close boxes don't stack labels on top of each other.
function drawDetection(ctx: CanvasRenderingContext2D, d: Detection, r: Rect, alpha: number, age: number, lockTime: number, chips: Rect[]) {
  if (age < 0 || alpha <= 0) return;
  const color = CATEGORY_COLOR[d.category];
  const lockU = lockTime > 0 ? easeOut(clamp01(age / lockTime)) : 1;
  const grow = (1 - lockU) * 0.6;
  const x = r.x - (r.w * grow) / 2;
  const y = r.y - (r.h * grow) / 2;
  const w = r.w * (1 + grow);
  const h = r.h * (1 + grow);
  const locked = age >= lockTime;

  ctx.globalAlpha = alpha * lerp(0.3, 1, lockU);
  ctx.strokeStyle = color;
  // Thin outline: dashed until a second model confirms, solid once locked and confirmed.
  ctx.lineWidth = 1;
  ctx.setLineDash(d.confirmed && locked ? [] : [5, 4]);
  ctx.globalAlpha *= 0.6;
  ctx.strokeRect(x, y, w, h);
  ctx.globalAlpha = alpha * lerp(0.3, 1, lockU);
  ctx.setLineDash([]);

  // Corner brackets.
  const c = Math.max(6, Math.min(w, h) * 0.28);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.moveTo(cx + dx * c, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * c);
  }
  ctx.stroke();

  // Lock-on pulse: one expanding ring when the detection is confirmed.
  const p = (age - lockTime) / PULSE;
  if (d.confirmed && p >= 0 && p < 1) {
    const pad = easeOut(p) * 14;
    ctx.globalAlpha = alpha * (1 - p);
    ctx.lineWidth = 2;
    ctx.strokeRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
  }

  // Label chip: filled when confirmed, outline only while unconfirmed.
  if (lockU < 0.5) return;
  ctx.globalAlpha = alpha;
  const text = `${CATEGORY_LABEL[d.category]} ${Math.round(d.confidence * 100)}%${d.confirmed ? "" : " ?"}`;
  ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
  const tw = ctx.measureText(text).width + 10;
  // Above the box, else below it; if both collide with another label, the brackets alone carry it.
  const chip = [y - 20, y + h + 2].map((cy) => ({ x, y: cy, w: tw, h: 18 })).find((c) => c.y >= 0 && !chips.some((o) => overlaps(o, c)));
  if (!chip) return;
  chips.push(chip);
  const ty = chip.y;
  if (d.confirmed) {
    ctx.fillStyle = color;
    ctx.fillRect(x, ty, tw, 18);
    ctx.fillStyle = "#0b0b0c";
  } else {
    ctx.fillStyle = "rgba(11,11,12,0.75)";
    ctx.fillRect(x, ty, tw, 18);
    ctx.strokeRect(x + 0.5, ty + 0.5, tw - 1, 17);
    ctx.fillStyle = color;
  }
  ctx.fillText(text, x + 5, ty + 13);
}

function drawScan(ctx: CanvasRenderingContext2D, y: number, width: number) {
  ctx.globalAlpha = 1;
  const glow = ctx.createLinearGradient(0, y - 70, 0, y);
  glow.addColorStop(0, "rgba(120,220,255,0)");
  glow.addColorStop(1, "rgba(120,220,255,0.18)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, y - 70, width, 70);
  ctx.fillStyle = "rgba(190,240,255,0.9)";
  ctx.fillRect(0, y - 1, width, 2);
}

function drawTag(ctx: CanvasRenderingContext2D, text: string) {
  ctx.globalAlpha = 1;
  ctx.font = "600 11px ui-monospace, SFMono-Regular, monospace";
  const w = ctx.measureText(text).width + 14;
  ctx.fillStyle = "rgba(11,11,12,0.7)";
  ctx.fillRect(10, 10, w, 22);
  ctx.fillStyle = "#e7f6ff";
  ctx.fillText(text, 17, 25);
}

export function TrackerOverlay({ keyframes, video, loop = false, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clock = useRef({ start: 0, pausedAt: 0, paused: false });
  const [aspect, setAspect] = useState(16 / 9);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !wrap || !ctx || keyframes.length === 0) return;

    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scanTime = calm ? 0 : 1.2;
    const lockTime = calm ? 0 : LOCK;
    const zoom = calm ? 0 : ZOOM;

    const images = keyframes.map((k) => {
      if (!k.image) return null;
      const img = new Image();
      img.src = k.image;
      return img;
    });
    images[0]?.addEventListener("load", () => setAspect(images[0]!.naturalWidth / images[0]!.naturalHeight), { once: true });

    // First time each id shows up, so lock-on plays once per physical issue, not once per keyframe.
    const firstSeen = new Map<string, number>();
    for (const k of keyframes) for (const d of k.detections) if (d.id && !firstSeen.has(d.id)) firstSeen.set(d.id, k.t);

    let W = 0;
    let H = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    clock.current = { start: performance.now(), pausedAt: 0, paused: false };

    const drawPhotos = (now: number) => {
      const c = clock.current;
      // rAF's timestamp can be a few ms older than the performance.now() the clock started at.
      const t = Math.max(0, ((c.paused ? c.pausedAt : now) - c.start) / 1000);
      const n = keyframes.length;
      const total = n * DWELL;
      const tt = loop ? t % total : Math.min(t, total - 0.001);
      const i = Math.floor(tt / DWELL);
      const local = tt - i * DWELL;
      const frame = keyframes[i];
      const img = images[i];
      const last = !loop && i === n - 1;

      // Slow push-in toward the middle of the hazards.
      const ds = frame.detections;
      const fx = ds.length ? ds.reduce((s, d) => s + d.box.x + d.box.w / 2, 0) / ds.length : 0.5;
      const fy = ds.length ? ds.reduce((s, d) => s + d.box.y + d.box.h / 2, 0) / ds.length : 0.5;
      const u = clamp01(local / DWELL);
      const z = 1 + zoom * u;
      const half = 0.5 / z;
      const cx = Math.min(1 - half, Math.max(half, lerp(0.5, fx, u)));
      const cy = Math.min(1 - half, Math.max(half, lerp(0.5, fy, u)));
      const toRect = (b: Box): Rect => ({ x: (b.x - cx + half) * z * W, y: (b.y - cy + half) * z * H, w: b.w * z * W, h: b.h * z * H });

      ctx.globalAlpha = 1;
      ctx.fillStyle = "#0b0b0c";
      ctx.fillRect(0, 0, W, H);
      const fadeIn = calm ? 1 : clamp01(local / FADE);
      const fadeOut = last || calm ? 1 : clamp01((DWELL - local) / FADE);
      if (img?.complete && img.naturalWidth) {
        ctx.globalAlpha = Math.min(fadeIn, fadeOut);
        const view = toRect({ x: 0, y: 0, w: 1, h: 1 });
        ctx.drawImage(img, view.x, view.y, view.w, view.h);
      }

      // Scan line sweeps once per photo = the frame going to the AI. Each box locks on as the line passes it.
      const scanY = scanTime ? (local / scanTime) * H : H;
      const chips: Rect[] = [];
      for (const d of ds) {
        const r = toRect(d.box);
        const lockAt = scanTime * clamp01((r.y + r.h / 2) / H);
        drawDetection(ctx, d, r, fadeOut, local - lockAt, lockTime, chips);
      }
      const confirmed = ds.filter((d) => d.confirmed).length;
      if (local < scanTime) {
        drawScan(ctx, scanY, W);
        drawTag(ctx, `SCANNING PHOTO ${i + 1}/${n}`);
      } else {
        drawTag(ctx, `${ds.length} HAZARD${ds.length === 1 ? "" : "S"} · ${confirmed} CONFIRMED`);
      }
    };

    const drawVideo = () => {
      const v = videoRef.current;
      if (!v) return;
      const t = v.currentTime;
      ctx.clearRect(0, 0, W, H);
      let i = -1;
      while (i + 1 < keyframes.length && keyframes[i + 1].t <= t) i++;
      const k0 = keyframes[i];
      const k1 = keyframes[i + 1];
      const toRect = (b: Box): Rect => ({ x: b.x * W, y: b.y * H, w: b.w * W, h: b.h * H });
      const chips: Rect[] = [];
      const age = (d: Detection, fallback: number) => t - (d.id ? (firstSeen.get(d.id) ?? fallback) : fallback);

      if (k0) {
        const u = k1 ? clamp01((t - k0.t) / (k1.t - k0.t)) : 0;
        for (const d of k0.detections) {
          const next = d.id ? k1?.detections.find((e) => e.id === d.id) : undefined;
          // Matched by id: glide to the next keyframe's box. Gone next keyframe: fade out. Last keyframe: hold 1 s, then fade.
          const alpha = next ? 1 : k1 ? 1 - u : 1 - clamp01((t - k0.t - 1) / FADE);
          drawDetection(ctx, next ? { ...d, confirmed: d.confirmed || next.confirmed } : d, toRect(next ? lerpBox(d.box, next.box, u) : d.box), alpha, age(d, k0.t), lockTime, chips);
        }
        if (t - k0.t < scanTime) drawScan(ctx, ((t - k0.t) / scanTime) * H, W);
      }
      if (k1) {
        const u = k0 ? clamp01((t - k0.t) / (k1.t - k0.t)) : 0;
        for (const d of k1.detections) {
          if (d.id && k0?.detections.some((e) => e.id === d.id)) continue;
          drawDetection(ctx, d, toRect(d.box), u, Math.max(0, age(d, k1.t)), lockTime, chips); // new id: fade in
        }
      }
    };

    let raf = 0;
    const tick = (now: number) => {
      if (video) drawVideo();
      else drawPhotos(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [keyframes, video, loop]);

  // Photo mode controls: click or Space pauses, arrow keys step photos.
  const togglePause = () => {
    const c = clock.current;
    const now = performance.now();
    if (c.paused) c.start += now - c.pausedAt;
    else c.pausedAt = now;
    c.paused = !c.paused;
  };
  const step = (by: number) => {
    const c = clock.current;
    const now = c.paused ? c.pausedAt : performance.now();
    const i = Math.floor((now - c.start) / 1000 / DWELL) % keyframes.length;
    const next = (i + by + keyframes.length) % keyframes.length;
    c.start = now - next * DWELL * 1000;
  };

  return (
    <div
      ref={wrapRef}
      className={`relative mx-auto w-full overflow-hidden rounded-lg bg-black ${className ?? ""}`}
      style={{ aspectRatio: aspect, maxWidth: `calc(75vh * ${aspect})` }}
      tabIndex={video ? undefined : 0}
      role={video ? undefined : "img"}
      aria-label={video ? undefined : `${keyframes.length} street photo${keyframes.length === 1 ? "" : "s"} with AI hazard boxes. Space pauses, arrow keys step.`}
      onClick={video ? undefined : togglePause}
      onKeyDown={(e) => {
        if (video) return;
        if (e.key === " ") togglePause();
        else if (e.key === "ArrowRight") step(1);
        else if (e.key === "ArrowLeft") step(-1);
        else return;
        e.preventDefault();
      }}
    >
      {video && (
        <video
          ref={videoRef}
          src={video}
          className="absolute inset-0 h-full w-full"
          controls
          muted
          playsInline
          onLoadedMetadata={(e) => setAspect(e.currentTarget.videoWidth / e.currentTarget.videoHeight)}
        />
      )}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
