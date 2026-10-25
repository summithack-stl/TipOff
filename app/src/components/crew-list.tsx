"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HotspotPanel } from "@/components/hotspot-panel";
import { TypeToggle } from "@/components/type-toggle";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABEL, HOTSPOT_VAR } from "@/lib/categories";
import { WATCH_COLUMNS, type Day } from "@/lib/crew";
import type { Hotspot, HotspotCategory } from "@/lib/hotspots";

export type CrewItem = { hotspot: Hotspot; watch: string; column: number; busyDays: Day[]; there: string[] };
export type DayLoad = { day: Day; counts: Record<HotspotCategory, number> };

const COLUMN_HOURS = ["12am–6am", "6am–12pm", "12pm–6pm", "6pm–12am"];

function HotspotCard({ item, onOpen }: { item: CrewItem; onOpen: () => void }) {
  const h = item.hotspot;
  const dumping = h.category === "dumping";
  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-lg leading-tight font-bold uppercase">{h.top_address || `${CATEGORY_LABEL[h.category]} hotspot`}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            #{h.rank} · Ward {h.ward ?? "?"} · {h.reports_12m} reports in 12 mo
          </p>
        </div>
        <span className="font-mono text-2xl font-semibold tabular-nums" style={{ color: HOTSPOT_VAR[h.category] }}>
          {h.score}
        </span>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        {dumping && (
          <>
            <dt className="text-muted-foreground">Watch</dt>
            <dd className="font-mono text-xs font-semibold">
              {item.watch} · busy {item.busyDays.join(", ") || h.peak_day}
            </dd>
          </>
        )}
        {/* 311 times are when people report, not when it happens. */}
        <dt className="text-muted-foreground">Reports</dt>
        <dd className="font-mono text-xs">
          {h.report_window}, mostly {h.peak_day}
        </dd>
      </dl>
      {item.there.length > 0 && (
        <ul className="space-y-0.5 text-muted-foreground">
          {item.there.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <Button variant="outline" size="sm" className="self-start font-heading text-sm font-semibold tracking-wide uppercase" onClick={onOpen}>
        Open plan
      </Button>
    </article>
  );
}

function WeekStrip({ load, day, today, category }: { load: DayLoad[]; day: Day; today: Day; category: HotspotCategory }) {
  const max = Math.max(1, ...load.map((l) => l.counts[category]));
  return (
    <nav aria-label="Day" className="grid grid-cols-7 gap-1.5">
      {load.map((l) => {
        const n = l.counts[category];
        return (
          <Link
            key={l.day}
            href={l.day === today ? "/crew" : `/crew?day=${l.day}`}
            aria-current={l.day === day ? "date" : undefined}
            className="press group flex flex-col gap-2 rounded-lg border bg-card p-2.5 hover:border-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=date]:border-hot aria-[current=date]:bg-hot/10 sm:p-3"
          >
            <span className="flex items-baseline justify-between gap-1">
              <span className="font-heading text-base font-bold tracking-wide uppercase sm:text-lg">{l.day}</span>
              <span className="hidden font-mono text-xs text-muted-foreground tabular-nums sm:inline">{n}</span>
            </span>
            <span aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-muted-foreground/60 group-aria-[current=date]:bg-hot" style={{ width: `${Math.max(4, (n / max) * 100)}%` }} />
            </span>
            <span className="sr-only">{n} busy hotspots</span>
            {l.day === today && <span className="font-mono text-[10px] text-hot uppercase">Today</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function CrewBoard({ items, day, today, load, sample }: { items: CrewItem[]; day: Day; today: Day; load: DayLoad[]; sample: boolean }) {
  const [category, setCategory] = useState<HotspotCategory>("dumping");
  const [open, setOpen] = useState<Hotspot | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const list = items.filter((i) => i.hotspot.category === category);
  const busy = load.find((l) => l.day === day)?.counts[category] ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.18em] text-hot uppercase">Crew board</p>
          <h1 className="mt-1 font-heading text-4xl leading-none font-bold tracking-tight uppercase">
            {day === today ? "Today" : day} · {list.length} blocks to watch
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The strongest of {busy} {CATEGORY_LABEL[category].toLowerCase()} hotspots that usually get reports on {day}, sorted by when to
            watch them. Places and times only: we never identify people, faces or license plates.
          </p>
        </div>
        <TypeToggle
          value={category}
          onChange={setCategory}
        />
      </header>

      {sample && (
        <p className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">
          Sample data, not real reports. Run data/scripts/build_hotspots.py to load the city&apos;s 311 data.
        </p>
      )}

      <WeekStrip load={load} day={day} today={today} category={category} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {WATCH_COLUMNS.map((name, col) => {
          const cards = list.filter((i) => i.column === col);
          return (
            <section key={name} aria-label={`${name} watch`} className="flex flex-col gap-3 rounded-xl bg-muted/50 p-3">
              <header className="flex items-baseline justify-between px-1">
                <h2 className="font-heading text-lg font-bold tracking-wide uppercase">{name}</h2>
                <span className="font-mono text-xs text-muted-foreground">
                  {COLUMN_HOURS[col]} · {cards.length}
                </span>
              </header>
              {cards.length ? (
                cards.map((item) => <HotspotCard key={item.hotspot.id} item={item} onOpen={() => setOpen(item.hotspot)} />)
              ) : (
                <p className="px-1 pb-2 text-sm text-muted-foreground">Nothing to watch in this window.</p>
              )}
            </section>
          );
        })}
      </div>

      <AnimatePresence>
        {open && (
          // The drawer positions itself against this layer, below the header.
          <motion.div
            key="drawer"
            className="fixed inset-x-0 top-[calc(3.5rem+var(--safe-top))] bottom-[calc(4rem+var(--safe-bottom))] z-[1000] md:bottom-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <button aria-label="Close plan" className="absolute inset-0 bg-black/40" onClick={close} />
            <HotspotPanel hotspot={open} onClose={close} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
