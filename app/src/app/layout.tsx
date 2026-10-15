import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "TipOff",
  description: "Finds repeat illegal-dumping hotspots in St. Louis 311 reports, confirms them in street photos, and plans where and when to act.",
};

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark h-full antialiased ${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <header className="flex h-14 shrink-0 items-center gap-6 border-b px-4">
          <Link href="/" className="font-semibold tracking-tight">
            Tip<span className="text-[var(--hot)]">Off</span>
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/map" className="hover:text-foreground">Map</Link>
            <Link href="/crew" className="hover:text-foreground">Crew</Link>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
