"use client";

import { useMemo, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import type { HeroPoint } from "@/components/landing/hero-map";
import { CATEGORY_COLOR } from "@/lib/categories";
import { WATCH_COLUMNS } from "@/lib/crew";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export type StoryFocus = {
  address: string;
  score: number;
  rank: number;
  ward: number | null;
  lat: number;
  lon: number;
  reportWindow: string;
  peakDay: string;
  byHour: number[];
  byDow: number[];
  windowHours: [number, number] | null;
};
export type StoryCrew = { address: string; score: number; watch: string; column: number };
export type StoryPlan = { headline: string; sections: { title: string; lines: string[] }[] };

const STEPS = [
  { title: "Open the map", body: "Every dot is a block where dumping reports keep coming back, scored 0 to 100." },
  { title: "Click a hotspot", body: "See its report history, the hours reports come in, and the vacant buildings nearby." },
  { title: "Write the plan", body: "One click. The Groq API writes it from that block's facts only: where to put a camera, when to watch, what a citation needs." },
  { title: "Send the crews", body: "Each morning the crew board sorts today's blocks by when to watch them." },
];

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const W = 400;
const H = 300;
const ORANGE = CATEGORY_COLOR.dumping;

// Equirectangular projection of the hotspots into the frame, corrected for latitude.
function project(points: HeroPoint[]) {
  const lats = points.map((p) => p[0]);
  const lons = points.map((p) => p[1]);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const s = Math.min((W * 0.9) / ((maxLon - minLon) * k), (H * 0.9) / (maxLat - minLat));
  const ox = (W - (maxLon - minLon) * k * s) / 2;
  const oy = (H - (maxLat - minLat) * s) / 2;
  return (lat: number, lon: number) => [ox + (lon - minLon) * k * s, oy + (maxLat - lat) * s] as const;
}

function Bars({ values, hot, labels }: { values: number[]; hot: (i: number) => boolean; labels?: string[] }) {
  const max = Math.max(1, ...values);
  return (
    <div>
      <div className="flex h-10 items-end gap-[2px]">
        {values.map((v, i) => (
          <span key={i} className="flex-1 rounded-[1px]" style={{ height: `${Math.max(6, (v / max) * 100)}%`, background: hot(i) ? ORANGE : "#3a3c41" }} />
        ))}
      </div>
      {labels && (
        <div className="mt-1 flex gap-[2px] font-mono text-[8px] text-[#7d7f84]">
          {labels.map((l, i) => (
            <span key={i} className="flex-1 text-center">{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScrollStory({ points, focus, crew, plan }: { points: HeroPoint[]; focus: StoryFocus; crew: StoryCrew[]; plan: StoryPlan }) {
  const root = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);

  const { dots, fx, fy } = useMemo(() => {
    const to = project(points);
    const [fx, fy] = to(focus.lat, focus.lon);
    return { dots: points.map(([lat, lon, score, reports]) => ({ xy: to(lat, lon), score, reports })), fx, fy };
  }, [points, focus.lat, focus.lon]);
  const maxReports = Math.max(1, ...dots.map((d) => d.reports));
  const inWindow = (h: number) => !!focus.windowHours && h >= focus.windowHours[0] && h < (focus.windowHours[1] || 24);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root);
        const steps = q("[data-step]");
        gsap.set(q("[data-frame]"), { scale: 1.3 });
        gsap.set(q("[data-map]"), { transformOrigin: `${(fx / W) * 100}% ${(fy / H) * 100}%` });
        gsap.set(q("[data-drawer]"), { xPercent: 105 });
        gsap.set(q("[data-plan]"), { autoAlpha: 0, scale: 0.6 });
        gsap.set(q("[data-crew]"), { autoAlpha: 0, yPercent: 10 });
        gsap.set(steps, { opacity: 0.25 });
        gsap.set(steps[0], { opacity: 1 });

        const tl = gsap.timeline({
          defaults: { ease: "power2.inOut", duration: 1 },
          scrollTrigger: { trigger: pin.current, start: "top top+=56", end: "+=3200", pin: true, scrub: 0.7, anticipatePin: 1 },
        });
        tl.to(q("[data-progress]"), { scaleY: 1, ease: "none", duration: 4 }, 0)
          // 1. The screen shrinks from close-up to the whole city.
          .to(q("[data-frame]"), { scale: 1 }, 0)
          // 2. Zoom into the top hotspot; its drawer slides in.
          .to(steps[0], { opacity: 0.25, duration: 0.3 }, 1)
          .to(steps[1], { opacity: 1, duration: 0.3 }, 1)
          // Scale around the hotspot, then slide it into the part of the frame the drawer leaves open.
          .to(q("[data-map]"), { scale: 2.6, xPercent: 27 - (fx / W) * 100, yPercent: 50 - (fy / H) * 100 }, 1)
          .to(q("[data-drawer]"), { xPercent: 0 }, 1.2)
          // 3. The plan grows out of the screen while the screen steps back.
          .to(steps[1], { opacity: 0.25, duration: 0.3 }, 2)
          .to(steps[2], { opacity: 1, duration: 0.3 }, 2)
          .to(q("[data-frame]"), { scale: 0.9 }, 2)
          .to(q("[data-app]"), { opacity: 0.3 }, 2)
          .to(q("[data-plan]"), { autoAlpha: 1, scale: 1 }, 2.1)
          // 4. The plan hands off to the crew board.
          .to(steps[2], { opacity: 0.25, duration: 0.3 }, 3)
          .to(steps[3], { opacity: 1, duration: 0.3 }, 3)
          .to(q("[data-plan]"), { autoAlpha: 0, scale: 1.12 }, 3)
          .to(q("[data-crew]"), { autoAlpha: 1, yPercent: 0 }, 3.1)
          .to(q("[data-frame]"), { scale: 1 }, 3);
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [fx, fy] },
  );

  return (
    <div ref={root}>
      <div ref={pin} className="flex items-center md:h-[calc(100svh-3.5rem)]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-center md:gap-14 md:py-0">
          <div className="order-2 md:order-1">
            <p className="font-mono text-xs tracking-[0.18em] text-hot uppercase">How it works</p>
            <h2 className="mt-3 font-heading text-4xl leading-none font-bold tracking-tight uppercase sm:text-5xl">From a 311 report to a plan</h2>
            <div className="mt-8 flex gap-5">
              <div aria-hidden className="relative hidden w-0.5 shrink-0 rounded-full bg-border md:block">
                <div data-progress className="absolute inset-0 origin-top scale-y-0 rounded-full bg-hot" />
              </div>
              <ol className="space-y-6">
                {STEPS.map((s, i) => (
                  <li key={s.title} data-step>
                    <span className="font-mono text-sm text-hot tabular-nums">0{i + 1}</span>
                    <h3 className="font-heading text-2xl font-semibold tracking-wide uppercase">{s.title}</h3>
                    <p className="mt-1 max-w-sm text-muted-foreground">{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="order-1 md:order-2">
            <div
              data-frame
              className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/10 bg-[#111316] text-[#ecebe7] shadow-2xl will-change-transform"
            >
              <div data-app className="absolute inset-0">
                <svg data-map viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-label="Dumping hotspots across St. Louis">
                  <defs>
                    <pattern id="story-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M20 0H0V20" fill="none" stroke="#1d1f23" strokeWidth="0.6" />
                    </pattern>
                  </defs>
                  <rect width={W} height={H} fill="url(#story-grid)" />
                  {dots.map((d, i) => (
                    <circle
                      key={i}
                      cx={d.xy[0]}
                      cy={d.xy[1]}
                      r={1.2 + 3.4 * Math.sqrt(d.reports / maxReports)}
                      fill={ORANGE}
                      fillOpacity={0.25 + 0.6 * (d.score / 100)}
                    />
                  ))}
                  <circle cx={fx} cy={fy} r={7} fill="none" stroke="#fff" strokeWidth={1} />
                </svg>

                <aside data-drawer className="absolute inset-y-0 right-0 flex w-[46%] flex-col gap-3 border-l border-white/10 bg-[#17181b] p-4">
                  <p className="font-mono text-[9px] text-[#8d8f94] uppercase">
                    #{focus.rank} dumping hotspot · Ward {focus.ward ?? "?"}
                  </p>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-heading text-lg leading-tight font-bold uppercase">{focus.address}</p>
                    <p className="font-mono text-2xl font-semibold" style={{ color: ORANGE }}>
                      {focus.score}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-[#a3a5a9]">Reports by hour · mostly {focus.reportWindow}</p>
                    <Bars values={focus.byHour} hot={inWindow} />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-[#a3a5a9]">By weekday · busiest {focus.peakDay}</p>
                    <Bars values={focus.byDow} hot={(i) => focus.byDow[i] === Math.max(...focus.byDow)} labels={DAY_LETTERS} />
                  </div>
                  <span className="mt-auto inline-flex h-8 items-center justify-center rounded-md font-heading text-sm font-semibold text-[#160a05] uppercase" style={{ background: ORANGE }}>
                    Write plan
                  </span>
                </aside>
              </div>

              <article data-plan className="invisible absolute inset-x-[9%] inset-y-[7%] overflow-hidden rounded-lg bg-[#fbfaf7] p-5 text-[#17171a] shadow-2xl">
                <p className="font-mono text-[9px] tracking-widest text-[#8a877f] uppercase">Example plan · {focus.address}</p>
                <p className="mt-1 font-heading text-lg leading-tight font-bold uppercase">{plan.headline}</p>
                <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3">
                  {plan.sections.map((s) => (
                    <section key={s.title}>
                      <h4 className="font-heading text-xs font-bold tracking-wide uppercase" style={{ color: "#e2480e" }}>
                        {s.title}
                      </h4>
                      <ul className="mt-1 space-y-0.5 text-[10px] leading-snug">
                        {s.lines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </article>

              <div data-crew className="invisible absolute inset-0 flex flex-col bg-[#0f1012] p-4">
                <p className="font-heading text-sm font-bold tracking-wide uppercase">Crew board · {focus.peakDay}</p>
                <div className="mt-3 grid flex-1 grid-cols-4 gap-2">
                  {WATCH_COLUMNS.map((c, col) => (
                    <div key={c} className="flex flex-col gap-1.5 rounded-md bg-[#16181b] p-2">
                      <p className="font-heading text-[10px] font-semibold tracking-wide text-[#8d8f94] uppercase">{c}</p>
                      {crew
                        .filter((x) => x.column === col)
                        .slice(0, 3)
                        .map((x) => (
                          <div key={x.address} className="rounded bg-[#1f2226] p-1.5">
                            <div className="flex justify-between gap-1">
                              <span className="truncate text-[9px]">{x.address}</span>
                              <span className="font-mono text-[10px] font-semibold" style={{ color: ORANGE }}>
                                {x.score}
                              </span>
                            </div>
                            <span className="font-mono text-[8px] text-[#8d8f94]">{x.watch}</span>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
