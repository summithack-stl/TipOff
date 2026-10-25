import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CrewList, type CrewItem } from "@/components/crew-list";
import { busyDays, cityToday, todaysHotspots, watchWindow, whatsThere, type Day, type Finding } from "@/lib/crew";
import { allHotspots, usingSample } from "@/lib/hotspot-store";
import { DAYS } from "@/lib/hotspots";

// Photo findings are the only file this page reads itself; hotspots come from the shared store.
function photoFindings(): Map<string, Finding[]> {
  const path = join(process.cwd(), "public/photos/index.json");
  const photos = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as { hotspot_id?: string; after: { detections?: Finding[] } }[])
    : [];
  return new Map(photos.flatMap((p) => (p.hotspot_id ? [[p.hotspot_id, p.after.detections ?? []] as const] : [])));
}

export default async function CrewPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day: asked } = await searchParams;
  const today = cityToday();
  const day: Day = (DAYS as readonly string[]).includes(asked ?? "") ? (asked as Day) : today;
  const findings = photoFindings();

  const items: CrewItem[] = todaysHotspots(allHotspots(), day).map((h) => ({
    hotspot: h,
    watch: watchWindow(h),
    busyDays: busyDays(h),
    there: whatsThere(h, findings.get(h.id)),
  }));

  return <CrewList items={items} day={day} today={today} sample={usingSample()} />;
}
