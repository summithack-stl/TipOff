import Link from "next/link";

// Served by the service worker when a page is opened with no signal and no cached copy.
export const metadata = { title: "Offline · TipOff" };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">No signal</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        This page has not been opened on this phone yet, so there is no copy to show. Today&apos;s crew list, the map
        and any plan already opened still work.
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/crew" className="rounded-md border px-4 py-2 hover:bg-muted">Today&apos;s crew list</Link>
        <Link href="/map" className="rounded-md border px-4 py-2 hover:bg-muted">Hotspot map</Link>
      </div>
    </div>
  );
}
