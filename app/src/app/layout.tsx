import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { OfflineBanner } from "@/components/offline-banner";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "TipOff",
  description: "Finds repeat illegal-dumping hotspots in St. Louis 311 reports, confirms them in street photos, and plans where and when to act.",
  applicationName: "TipOff",
  // Installed from a phone's home screen, the app runs without browser chrome.
  appleWebApp: { capable: true, title: "TipOff", statusBarStyle: "black-translucent" },
  // Next emits the standard "mobile-web-app-capable" for appleWebApp.capable. iOS 16.4+ reads
  // display: "standalone" from the manifest, but older iPhones still need the legacy name.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  // Draw into the notch and home-bar area; globals.css keeps content out of them with env(safe-area-inset-*).
  viewportFit: "cover",
};

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark h-full antialiased ${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <OfflineBanner />
        <header className="flex h-[calc(3.5rem+var(--safe-top))] shrink-0 items-center gap-6 border-b px-4 pt-[var(--safe-top)]">
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
