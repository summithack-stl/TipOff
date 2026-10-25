"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { HotspotPanel } from "@/components/hotspot-panel";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORY_COLOR, CATEGORY_LABEL } from "@/lib/categories";
import type { Day } from "@/lib/crew";
import { DAYS, HOTSPOT_CATEGORIES, type Hotspot } from "@/lib/hotspots";

export type CrewItem = { hotspot: Hotspot; watch: string; busyDays: Day[]; there: string[] };

function HotspotCard({ item, onOpen }: { item: CrewItem; onOpen: () => void }) {
  const h = item.hotspot;
  const dumping = h.category === "dumping";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLOR[h.category] }} />
          {h.top_address || `${CATEGORY_LABEL[h.category]} hotspot`}
        </CardTitle>
        <CardDescription>
          #{h.rank} {CATEGORY_LABEL[h.category].toLowerCase()} hotspot · Ward {h.ward ?? "?"} · {h.reports_12m} reports in 12 months
        </CardDescription>
        <CardAction>
          <span className="text-2xl font-bold tabular-nums">{h.score}</span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {dumping && (
            <>
              <dt className="text-muted-foreground">Suggested watch</dt>
              <dd className="font-medium">
                {item.watch}, ahead of busy days ({item.busyDays.join(", ") || h.peak_day})
              </dd>
            </>
          )}
          {/* 311 times are when people report, not when it happens. */}
          <dt className="text-muted-foreground">Reports come in</dt>
          <dd>{h.report_window}, mostly {h.peak_day}</dd>
          <dt className="text-muted-foreground">What&apos;s there</dt>
          <dd>
            <ul className="space-y-0.5">
              {item.there.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </dd>
        </dl>
        <Button className="self-start" onClick={onOpen}>
          Open plan
        </Button>
      </CardContent>
    </Card>
  );
}

export function CrewList({ items, day, today, sample }: { items: CrewItem[]; day: Day; today: Day; sample: boolean }) {
  const [open, setOpen] = useState<Hotspot | null>(null);
  const close = useCallback(() => setOpen(null), []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">{day === today ? "Today's hotspots" : `Hotspots for ${day}`}</h1>
        <p className="text-sm text-muted-foreground">
          Repeat 311 hotspots with a busy report day on {day}, strongest first. For cleanup crews and enforcement. Places and times
          only: we never identify people, faces or license plates.
        </p>
        {sample && (
          <p className="mt-2 rounded-md border border-destructive/50 p-2 text-sm text-destructive">
            Sample data, not real reports. Run data/scripts/build_hotspots.py to load the city&apos;s 311 data.
          </p>
        )}
      </div>

      <nav aria-label="Day" className="flex flex-wrap gap-1">
        {DAYS.map((d) => (
          <Button key={d} size="sm" variant={d === day ? "default" : "outline"} render={<Link href={d === today ? "/crew" : `/crew?day=${d}`} />}>
            {d === today ? `${d} (today)` : d}
          </Button>
        ))}
      </nav>

      <Tabs defaultValue="dumping">
        <TabsList>
          {HOTSPOT_CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c}>
              {CATEGORY_LABEL[c]} ({items.filter((i) => i.hotspot.category === c).length})
            </TabsTrigger>
          ))}
        </TabsList>
        {HOTSPOT_CATEGORIES.map((c) => {
          const list = items.filter((i) => i.hotspot.category === c);
          return (
            <TabsContent key={c} value={c} className="flex flex-col gap-3 pt-2">
              {list.length ? (
                list.map((item) => <HotspotCard key={item.hotspot.id} item={item} onOpen={() => setOpen(item.hotspot)} />)
              ) : (
                <p className="text-sm text-muted-foreground">No {CATEGORY_LABEL[c].toLowerCase()} hotspots are busy on {day}.</p>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {open && (
        // The panel positions itself against this layer, below the header.
        <div className="fixed inset-x-0 bottom-0 top-[calc(3.5rem+var(--safe-top))] z-[1000]">
          <button aria-label="Close plan" className="absolute inset-0 bg-black/40" onClick={close} />
          <HotspotPanel id={open.id} initial={open} onClose={close} />
        </div>
      )}
    </div>
  );
}
