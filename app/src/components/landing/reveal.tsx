"use client";

import { motion, useReducedMotion } from "motion/react";

// Small view-triggered pieces for the landing page. Everything renders in its final state when motion is reduced.

const TOP_N = 50;

export function DotMatrix({ hits }: { hits: number }) {
  const reduce = useReducedMotion();
  return (
    <figure>
      <div role="img" aria-label={`${hits} of the top ${TOP_N} blocks got dumping or debris reports again`} className="grid w-full max-w-md grid-cols-10 gap-2.5">
        {Array.from({ length: TOP_N }, (_, i) => (
          <motion.span
            key={i}
            className={`aspect-square rounded-full border-2 ${i < hits ? "border-hot bg-hot" : "border-muted-foreground/40"}`}
            initial={reduce ? false : { scale: 0.4, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.35, delay: i * 0.015, ease: [0.23, 1, 0.32, 1] }}
          />
        ))}
      </div>
      <figcaption className="mt-4 flex items-center gap-5 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-hot" /> Dumped on again
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full border-2 border-muted-foreground/40" /> No new reports
        </span>
      </figcaption>
    </figure>
  );
}

export function WeightBars({ weights }: { weights: { label: string; pct: number }[] }) {
  const reduce = useReducedMotion();
  const max = Math.max(...weights.map((w) => w.pct));
  return (
    <ul className="space-y-6">
      {weights.map((w, i) => (
        <li key={w.label}>
          <div className="flex justify-between gap-4 font-heading text-lg font-semibold tracking-wide uppercase">
            <span>{w.label}</span>
            <span className="font-mono text-base text-muted-foreground tabular-nums">{w.pct}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted">
            <motion.div
              className="h-full origin-left rounded-full bg-hot"
              style={{ width: `${(w.pct / max) * 100}%` }}
              initial={reduce ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.23, 1, 0.32, 1] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
