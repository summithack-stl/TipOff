import Link from "next/link";
import summary from "../../data/clean/hotspots_summary.json";

// Landing page: what TipOff does, how to use it, and how a city team configures it.
// Counts come from the nightly data build; the backtest numbers are the frozen run shown in our video.

const REPO = "https://github.com/summithack-stl/summithack";
const asOf = new Date(`${summary.window_end}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const STATS = [
  { value: summary.counts.dumping.toLocaleString("en-US"), label: "dumping hotspots ranked" },
  { value: "42 / 50", label: "top hotspots dumped on again in the next year" },
  { value: "Nightly", label: `refreshed from City 311 data, last ${asOf}` },
];

const STEPS = [
  {
    title: "Open the map",
    body: "Every dot is a block where reports keep coming back, scored 0 to 100. Filter by type, ward, day and hour.",
  },
  {
    title: "Click a hotspot",
    body: "See its report history, the day and hours reports come in, nearby vacant buildings and what street photos show.",
  },
  {
    title: "Write the plan",
    body: "One click. The AI uses only that block's facts: where to put a camera, when to watch, what to do and what evidence a citation needs.",
  },
  {
    title: "Send the crews",
    body: "Each morning the Crew list shows the blocks that usually get reports on today's weekday, with a watch window and the plan.",
  },
];

const WEIGHTS = [
  { label: "Report volume", pct: 40 },
  { label: "Different weeks reported", pct: 30 },
  { label: "Trend vs. the year before", pct: 15 },
  { label: "Vacant buildings within 150 m", pct: 15 },
];

const CONFIG = [
  {
    title: "Connect your own 311 data",
    where: "data/scripts/fetch_311.py",
    body: "Replace the public CSV download with a query that returns request ID, problem code, location, time opened and status. Nothing else changes.",
  },
  {
    title: "Change how blocks are scored",
    where: "data/scripts/build_hotspots.py",
    body: "The four weights live on one line. Re-run the backtest after a change to check the ranking still holds up.",
  },
  {
    title: "Swap the AI model",
    where: "app/.env.local",
    body: "Set LLM_BASE_URL, LLM_API_KEY and LLM_MODEL. Any OpenAI-compatible provider works; ours is Groq, with Gemini as the fallback.",
  },
  {
    title: "Keep it fresh",
    where: ".github/workflows/refresh-data.yml",
    body: "Runs every night: downloads the latest 311 file, rebuilds hotspots and the backtest, and redeploys. No one has to touch it.",
  },
];

const LIMITS = [
  "No face or license-plate recognition, anywhere.",
  "Residents keep reporting through 311 exactly as they do now.",
  "The score orders where to look first. It does not predict crime or identify people.",
  "Report times are when people report, not when dumping happens, so cameras record around the clock.",
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-xs tracking-[0.18em] text-[var(--hot)] uppercase">{children}</p>;
}

export default function Landing() {
  return (
    <div className="landing mx-auto w-full max-w-5xl px-5 pb-24 sm:px-8">
      <section className="pt-16 pb-14 sm:pt-24">
        <div className="rise" style={{ "--i": 0 } as React.CSSProperties}>
          <Eyebrow>St. Louis · Illegal dumping</Eyebrow>
        </div>
        <h1
          className="rise mt-5 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          Know where dumping comes back, and when.
        </h1>
        <p className="rise mt-6 max-w-2xl text-lg text-pretty text-muted-foreground" style={{ "--i": 2 } as React.CSSProperties}>
          TipOff turns the City&apos;s own 311 reports into a ranked list of repeat dumping blocks, the hours they get
          reported, and a camera and cleanup plan for each one. Built for city staff.
        </p>
        <div className="rise mt-9 flex flex-wrap gap-3" style={{ "--i": 3 } as React.CSSProperties}>
          <Link href="/map" className="press inline-flex h-11 items-center rounded-md bg-[var(--hot)] px-5 text-sm font-medium text-black">
            Open the hotspot map
          </Link>
          <Link href="/crew" className="press inline-flex h-11 items-center rounded-md border px-5 text-sm font-medium hover:bg-muted">
            Today&apos;s crew list
          </Link>
        </div>
      </section>

      <dl className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
        {STATS.map((s) => (
          <div key={s.label} className="bg-background p-6">
            <dt className="text-sm text-muted-foreground">{s.label}</dt>
            <dd className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-24">
        <Eyebrow>How to use it</Eyebrow>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">From a 311 report to a plan in four steps.</h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t pt-5">
              <span className="font-mono text-sm text-[var(--hot)] tabular-nums">0{i + 1}</span>
              <h3 className="mt-2 font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-24 grid gap-10 sm:grid-cols-[1fr_1.2fr] sm:gap-16">
        <div>
          <Eyebrow>How a block is scored</Eyebrow>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">A plain formula, not a black box.</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            The city is split into squares about a block wide. A square becomes a hotspot after 5 or more reports of one type.
            Its 0 to 100 score comes from the last 12 months. We scored blocks as of a year ago, hid the next year, and 42 of
            the top 50 got dumping or debris reports again.
          </p>
        </div>
        <ul className="space-y-5 self-center">
          {WEIGHTS.map((w) => (
            <li key={w.label}>
              <div className="flex justify-between text-sm">
                <span>{w.label}</span>
                <span className="font-mono text-muted-foreground tabular-nums">{w.pct}%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted">
                <div className="h-full rounded-full bg-[var(--hot)]" style={{ width: `${w.pct * 2.5}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-24">
        <Eyebrow>Configure and change</Eyebrow>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Made for a city IT team to own.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {CONFIG.map((c) => (
            <div key={c.title} className="rounded-lg border p-6">
              <h3 className="font-medium">{c.title}</h3>
              <code className="mt-2 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{c.where}</code>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-24">
        <Eyebrow>What it won&apos;t do</Eyebrow>
        <ul className="mt-6 grid gap-x-10 gap-y-3 text-sm text-muted-foreground sm:grid-cols-2">
          {LIMITS.map((l) => (
            <li key={l} className="flex gap-3">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--hot)]" />
              {l}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-sm text-muted-foreground">
        <span>Civic AI Hackathon 2026 · Problem Set #3 · Open source (MIT)</span>
        <a href={REPO} className="hover:text-foreground">
          Source and setup on GitHub
        </a>
      </footer>
    </div>
  );
}
