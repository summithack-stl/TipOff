"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { ClipboardListIcon, HouseIcon, MapIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

const LINKS = [
  { href: "/", label: "Overview", icon: HouseIcon },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/crew", label: "Crew", icon: ClipboardListIcon },
] as const;

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // The label stays fixed: the server can't know the theme, and a changing label breaks hydration.
  return (
    <Button variant="ghost" size="icon" aria-label="Toggle light and dark theme" onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}>
      {/* Both icons render; CSS picks one so the server and client markup match. */}
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  );
}

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-[1100] flex h-[calc(3.5rem+var(--safe-top))] shrink-0 items-center gap-8 border-b bg-background/85 px-4 pt-[var(--safe-top)] backdrop-blur-md sm:px-6">
      <Link href="/" aria-label="TipOff home" className="rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <Wordmark />
      </Link>
      <nav aria-label="Main" className="hidden gap-1 font-heading text-sm font-semibold tracking-wide uppercase md:flex">
        {LINKS.slice(1).map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(path, l.href) ? "page" : undefined}
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:text-foreground"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}

// Phones get a bottom tab bar instead of header links.
export function MobileTabs() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-[1100] grid h-[calc(4rem+var(--safe-bottom))] grid-cols-3 border-t bg-background/95 pb-[var(--safe-bottom)] backdrop-blur-md md:hidden"
    >
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(path, href) ? "page" : undefined}
          className="flex flex-col items-center justify-center gap-0.5 font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase aria-[current=page]:text-hot"
        >
          <Icon className="size-5" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
