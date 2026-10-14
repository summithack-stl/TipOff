import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CrewList, type CrewItem } from "@/components/crew-list";
import { busyDays, cityToday, todaysHotspots, watchWindow, whatsThere, type Day, type Finding } from "@/lib/crew";
import { DAYS, type Hotspot } from "@/lib/hotspots";

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}

// Same files as the map page: the real hotspots win, the fake sample keeps a fresh clone working.
function load(): { hotspots: Hotspot[]; sample: boolean; findings: Map<string, Finding[]> } {
  const real = join(process.cwd(), "data/clean/hotspots.json");
  const sample = !existsSync(real);
  const hotspots = readJson<Hotspot[]>(sample ? join(process.cwd(), "data/sample/hotspots.sample.json") : real, []);
  const photos = readJson<{ hotspot_id?: string; after: { detections?: Finding[] } }[]>(
    join(process.cwd(), "public/photos/index.json"),
    [],
  );
  const findings = new Map(photos.flatMap((p) => (p.hotspot_id ? [[p.hotspot_id, p.after.detections ?? []] as const] : [])));
  return { hotspots, sample, findings };
}

export default async function CrewPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day: asked } = await searchParams;
  const today = cityToday();
  const day: Day = (DAYS as readonly string[]).includes(asked ?? "") ? (asked as Day) : today;
  const { hotspots, sample, findings } = load();

  const items: CrewItem[] = todaysHotspots(hotspots, day).map((h) => ({
    hotspot: h,
    watch: watchWindow(h),
    busyDays: busyDays(h),
    there: whatsThere(h, findings.get(h.id)),
  }));

  return <CrewList items={items} day={day} today={today} sample={sample} />;
}
