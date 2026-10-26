import { cn } from "cn";

// A map pin beside a tilted 311-ticket stamp. The pin stays upright; only the stamp tilts.
export function Wordmark({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <svg viewBox="0 0 16 22" aria-hidden className={cn("shrink-0 text-hot", lg ? "h-8" : "h-5")}>
        <path d="M8 0a8 8 0 0 0-8 8c0 6 8 14 8 14s8-8 8-14a8 8 0 0 0-8-8Z" fill="currentColor" />
        <circle cx="8" cy="8" r="3" className="fill-background" />
      </svg>
      <span
        className={cn(
          "inline-block -rotate-6 rounded-[3px] border-2 border-dashed border-hot font-mono font-semibold tracking-[0.14em] text-hot",
          lg ? "px-3 py-1 text-2xl" : "px-1.5 py-px text-sm",
        )}
      >
        TipOff
      </span>
    </span>
  );
}
