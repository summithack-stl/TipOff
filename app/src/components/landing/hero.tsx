"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { HeroPoint } from "@/components/landing/hero-map";

// Leaflet touches window on import, so the map only loads in the browser.
const HeroMap = dynamic(() => import("@/components/landing/hero-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#0e0f11]" />,
});

export function Hero({ points, stats }: { points: HeroPoint[]; stats: { value: string; label: string }[] }) {
  return (
    <section className="relative isolate flex min-h-[600px] flex-col overflow-hidden bg-[#0e0f11] text-[#ecebe7] lg:h-[calc(100svh-3.5rem)] lg:max-h-[900px]">
      <div className="absolute inset-0 -z-10">
        <HeroMap points={points} />
      </div>
      {/* Keeps the headline readable over the dots; the map stays dark in both themes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(14_15_17/0.95)_0%,rgb(14_15_17/0.75)_38%,rgb(14_15_17/0)_70%),linear-gradient(0deg,rgb(14_15_17/0.9)_0%,rgb(14_15_17/0)_35%)]"
      />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end px-5 pt-24 pb-10 sm:px-8 lg:justify-center lg:pb-16">
        <p className="font-mono text-xs tracking-[0.18em] text-[#ff6a2b] uppercase">St. Louis · 311 · Illegal dumping</p>
        <h1 className="mt-5 max-w-3xl font-heading text-6xl leading-[0.9] font-bold tracking-tight uppercase sm:text-8xl">
          Dumping comes back.
          <span className="block text-[#ff6a2b]">We know where.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-pretty text-[#c9c8c3]">
          TipOff turns the City&apos;s own 311 reports into a ranked list of repeat dumping blocks, the hours they get reported, and a
          camera and cleanup plan for each one. Built for city staff.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 font-heading text-base font-semibold tracking-wide uppercase">
          <Link
            href="/map"
            className="press inline-flex h-12 items-center rounded-md bg-[#ff6a2b] px-6 text-[#160a05] hover:bg-[#ff7f47] focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            Open the hotspot map
          </Link>
          <Link
            href="/crew"
            className="press inline-flex h-12 items-center rounded-md border border-white/20 px-6 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            Today&apos;s crew board
          </Link>
        </div>
      </div>

      <dl className="relative mx-auto grid w-full max-w-6xl grid-cols-1 gap-px border-t border-white/10 px-5 sm:grid-cols-3 sm:px-8">
        {stats.map((s) => (
          <div key={s.label} className="py-5 sm:pr-6">
            <dd className="font-mono text-2xl font-semibold tabular-nums">{s.value}</dd>
            <dt className="mt-1 text-sm text-[#9a9994]">{s.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
