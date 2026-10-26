import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { MobileTabs, SiteHeader } from "@/components/site-chrome";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f11" },
  ],
  // Draw into the notch and home-bar area; globals.css keeps content out of them with env(safe-area-inset-*).
  viewportFit: "cover",
};

// Condensed for headings and UI labels, regular width for reading, mono for scores, times and addresses.
const condensed = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-barlow-condensed" });
const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-barlow" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`h-full antialiased ${condensed.variable} ${body.variable} ${mono.variable}`}>
      <body className="flex min-h-full flex-col bg-background pb-[calc(4rem+var(--safe-bottom))] text-foreground md:pb-[var(--safe-bottom)]">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <SiteHeader />
            <main className="flex flex-1 flex-col">{children}</main>
            <MobileTabs />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
