import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { connection } from "next/server";
import { CrewBoard, type CrewItem, type DayLoad } from "@/components/crew-list";
import { busyDays, cityToday, todaysHotspots, watchColumn, watchWindow, whatsThere, type Day, type Finding } from "@/lib/crew";
import { loadHotspots } from "@/lib/hotspot-data";
import { DAYS, HOTSPOT_CATEGORIES } from "@/lib/hotspots";

function photoFindings(): Map<string, Finding[]> {
  const file = join(process.cwd(), "public/photos/index.json");
  const photos = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { hotspot_id?: string; after: { detections?: Finding[] } }[]) : [];
  return new Map(photos.flatMap((p) => (p.hotspot_id ? [[p.hotspot_id, p.after.detections ?? []] as const] : [])));
}

export default async function CrewPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day: asked } = await searchParams;
  await connection(); // "today" depends on the request time, so this page is never prerendered
  const today = cityToday();
  const day: Day = (DAYS as readonly string[]).includes(asked ?? "") ? (asked as Day) : today;
  const { hotspots, sample } = loadHotspots();
  const findings = photoFindings();

  const items: CrewItem[] = todaysHotspots(hotspots, day).map((h) => ({
    hotspot: h,
    watch: watchWindow(h),
    column: watchColumn(h),
    busyDays: busyDays(h),
    there: whatsThere(h, findings.get(h.id)),
  }));

  // How many hotspots of each type are busy on each weekday, before the top-10 cut.
  const load: DayLoad[] = DAYS.map((d) => {
    const busy = todaysHotspots(hotspots, d, Infinity);
    return { day: d, counts: Object.fromEntries(HOTSPOT_CATEGORIES.map((c) => [c, busy.filter((h) => h.category === c).length])) as DayLoad["counts"] };
  });

  return <CrewBoard items={items} day={day} today={today} load={load} sample={sample} />;
}
