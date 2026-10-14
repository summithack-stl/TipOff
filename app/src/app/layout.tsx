import type { Metadata } from "next";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "StreetSense",
  description: "Finds repeat illegal-dumping hotspots in St. Louis 311 reports, confirms them in street photos, and plans where and when to act.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <header className="flex h-14 shrink-0 items-center gap-6 border-b px-4">
          <span className="font-semibold">StreetSense</span>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Hotspots</Link>
            <Link href="/watch" className="hover:text-foreground">Tracker</Link>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
