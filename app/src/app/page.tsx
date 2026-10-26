import Link from "next/link";
import summary from "../../data/clean/hotspots_summary.json";
import { InstallCard } from "@/components/install-card";
import { Hero } from "@/components/landing/hero";
import type { HeroPoint } from "@/components/landing/hero-map";
import { DotMatrix, WeightBars } from "@/components/landing/reveal";
import { ScrollStory, type StoryCrew, type StoryFocus, type StoryPlan } from "@/components/landing/scroll-story";
import { Wordmark } from "@/components/wordmark";
import { parseWindow, todaysHotspots, watchColumn, watchWindow } from "@/lib/crew";
import { loadHotspots } from "@/lib/hotspot-data";

// Landing page: what TipOff does, proof it works, how to use it, and how a city team configures it.
// Counts come from the nightly data build; the backtest numbers are the frozen run shown in our video.

const REPO = "https://github.com/summithack-stl/summithack";
const BACKTEST = `${REPO}/blob/main/data/backtest/2026-10-14-video-RESULTS.md`;
const asOf = new Date(`${summary.window_end}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const BACKTEST_ROWS = [
  { top: 10, hits: 9 },
  { top: 50, hits: 42 },
  { top: 100, hits: 83 },
];

const METHOD = [
  "Froze the 311 data at Oct 14, 2025, so the score only saw reports up to that day.",
  "Scored every dumping hotspot with the same formula the app uses today.",
  "Hid the next 12 months from the score completely.",
  "Counted how many of the top-ranked blocks got dumping or debris reports again in those 12 months.",
];

const ROLES = [
  { who: "Refuse crews", what: "A daily board of the blocks that usually get reports today, sorted by when to watch them." },
  { who: "Camera placement", what: `A ranked list of ${summary.counts.dumping.toLocaleString("en-US")} dumping hotspots, so the few cameras go where dumping keeps coming back.` },
  { who: "Code enforcement", what: "Each block's plan lists the evidence a citation needs." },
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
    wide: true,
  },
  {
    title: "Swap the plan-writing API",
    where: "app/.env.local",
    body: "Any OpenAI-compatible provider works. Ours is Groq, with Gemini as the fallback.",
    wide: false,
  },
  {
    title: "Change how blocks are scored",
    where: "data/scripts/build_hotspots.py",
    body: "The four weights live on one line. Re-run the backtest after a change.",
    wide: false,
  },
  {
    title: "Keep it fresh",
    where: ".github/workflows/refresh-data.yml",
    body: "Every night it downloads the latest 311 file, rebuilds hotspots and the backtest, and redeploys. No one has to touch it.",
    wide: true,
  },
];

const LIMITS = [
  "No face or license-plate recognition, anywhere.",
  "Residents keep reporting through 311 exactly as they do now.",
  "The score orders where to look first. It does not predict crime or identify people.",
  "Report times are when people report, not when dumping happens, so cameras record around the clock.",
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-xs tracking-[0.18em] text-hot uppercase">{children}</p>;
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-3 font-heading text-4xl leading-none font-bold tracking-tight text-balance uppercase sm:text-5xl">{children}</h2>;
}

function landingData() {
  const { hotspots } = loadHotspots();
  const dumping = hotspots.filter((h) => h.category === "dumping").sort((a, b) => b.score - a.score);
  const points: HeroPoint[] = dumping.slice(0, 400).map((h) => [h.lat, h.lon, h.score, h.report_count]);

  const top = dumping[0];
  const focus: StoryFocus = {
    address: top.top_address,
    score: top.score,
    rank: top.rank,
    ward: top.ward,
    lat: top.lat,
    lon: top.lon,
    reportWindow: top.report_window,
    peakDay: top.peak_day,
    byHour: top.by_hour,
    byDow: top.by_dow,
    windowHours: parseWindow(top.report_window),
  };
  // Illustration only, built from the block's own facts; the real plan comes from /api/plan.
  const plan: StoryPlan = {
    headline: `Camera on the block, crews before ${top.peak_day}`,
    sections: [
      { title: "What we know", lines: [`${top.reports_12m} reports in the last 12 months`, `Reported in ${top.active_weeks_12m} different weeks`, `${top.vacant_within_150m} vacant buildings within 150 m`] },
      { title: "Where and when", lines: [`Reports mostly come in ${top.report_window}`, `Busiest day: ${top.peak_day}`, `Suggested watch: ${watchWindow(top)}`] },
      { title: "Actions", lines: ["Camera recording 24/7 facing the alley", `Scheduled cleanup ahead of ${top.peak_day}`] },
      { title: "Evidence", lines: ["Time-stamped photos before and after", "311 ticket IDs for each report"] },
    ],
  };
  const crew: StoryCrew[] = todaysHotspots(hotspots, top.peak_day)
    .filter((h) => h.category === "dumping")
    .map((h) => ({ address: h.top_address, score: h.score, watch: watchWindow(h), column: watchColumn(h) }));

  return { points, focus, plan, crew };
}

export default function Landing() {
  const { points, focus, plan, crew } = landingData();

  return (
    <div>
      <Hero
        points={points}
        stats={[
          { value: summary.counts.dumping.toLocaleString("en-US"), label: "dumping hotspots ranked" },
          { value: "42 / 50", label: "top blocks dumped on again the next year" },
          { value: "Nightly", label: `refreshed from City 311 data, last ${asOf}` },
        ]}
      />

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-24 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16 md:py-32">
        <div>
          <Eyebrow>Does it work?</Eyebrow>
          <Heading>42 of the top 50 got dumped on again</Heading>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            We scored every block as if it were a year ago, then checked the next twelve months the score never saw.
          </p>
          <table className="mt-8 w-full max-w-sm text-left">
            <thead className="font-heading text-sm tracking-wide text-muted-foreground uppercase">
              <tr className="border-b">
                <th className="py-2 font-semibold">Top blocks</th>
                <th className="py-2 font-semibold">Reported again</th>
                <th className="py-2 text-right font-semibold">Rate</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {BACKTEST_ROWS.map((r) => (
                <tr key={r.top} className="border-b">
                  <td className="py-2.5">{r.top}</td>
                  <td className="py-2.5">{r.hits}</td>
                  <td className="py-2.5 text-right text-hot">{Math.round((r.hits / r.top) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:pt-8">
          <DotMatrix hits={42} />
          <h3 className="mt-10 font-heading text-xl font-semibold tracking-wide uppercase">How the test worked</h3>
          <ol className="mt-4 space-y-3">
            {METHOD.map((m, i) => (
              <li key={m} className="grid grid-cols-[2rem_minmax(0,1fr)] text-muted-foreground">
                <span className="font-mono text-sm text-hot tabular-nums">0{i + 1}</span>
                {m}
              </li>
            ))}
          </ol>
          <a href={BACKTEST} className="mt-5 inline-block text-sm underline underline-offset-4 hover:text-hot">
            Full table and method
          </a>
        </div>
      </section>

      <section className="band-invert">
        <ScrollStory points={points} focus={focus} crew={crew} plan={plan} />
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 md:py-32">
        <Eyebrow>Who it helps</Eyebrow>
        <Heading>Built for city staff, not residents</Heading>
        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.who} className="bg-background p-6">
              <h3 className="font-heading text-2xl font-semibold tracking-wide uppercase">{r.who}</h3>
              <p className="mt-2 text-muted-foreground">{r.what}</p>
            </div>
          ))}
        </div>

        <div className="mt-28 grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-16">
          <div>
            <Eyebrow>How a block is scored</Eyebrow>
            <Heading>A plain formula, not a black box</Heading>
            <p className="mt-5 max-w-md text-muted-foreground">
              The city is split into squares about a block wide. A square becomes a hotspot after 5 or more reports of one type, and
              its 0 to 100 score comes from the last 12 months.
            </p>
          </div>
          <div className="self-center">
            <WeightBars weights={WEIGHTS} />
          </div>
        </div>
      </section>

      <section className="band-invert">
        <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 md:py-32">
          <Eyebrow>Configure and change</Eyebrow>
          <Heading>Made for a city IT team to own</Heading>
          <div className="mt-12 grid gap-4 md:grid-cols-5">
            {CONFIG.map((c) => (
              <div key={c.title} className={`flex flex-col rounded-lg border bg-card p-6 ${c.wide ? "md:col-span-3" : "md:col-span-2"}`}>
                <h3 className="font-heading text-2xl font-semibold tracking-wide uppercase">{c.title}</h3>
                <p className="mt-2 text-muted-foreground">{c.body}</p>
                <code className="mt-auto self-start pt-6 font-mono text-xs text-hot">{c.where}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* UI: Sarthak */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 md:pt-32">
        <Eyebrow>Install on your phone</Eyebrow>
        <Heading>Crews carry it into the field</Heading>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          TipOff installs from the browser: no app store, no account. It opens straight to today&apos;s crew board and runs full screen.
        </p>
        <div className="mt-10">
          <InstallCard />
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-24 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:py-32">
        <div>
          <Eyebrow>What it won&apos;t do</Eyebrow>
          <Heading>Places and times, never people</Heading>
        </div>
        <ul className="grid gap-x-10 gap-y-4 self-end sm:grid-cols-2">
          {LIMITS.map((l) => (
            <li key={l} className="flex gap-3 text-muted-foreground">
              <span aria-hidden className="mt-2 size-2 shrink-0 bg-hot" />
              {l}
            </li>
          ))}
        </ul>
      </section>

      <section className="band-invert">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-end md:justify-between">
          <h2 className="font-heading text-5xl leading-none font-bold tracking-tight uppercase sm:text-7xl">
            See where it
            <br />
            comes back.
          </h2>
          <div className="flex flex-wrap gap-3 font-heading text-base font-semibold tracking-wide uppercase">
            <Link href="/map" className="press inline-flex h-12 items-center rounded-md bg-hot px-6 text-hot-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              Open the hotspot map
            </Link>
            <Link href="/crew" className="press inline-flex h-12 items-center rounded-md border px-6 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              Crew board
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:px-8">
        <Wordmark />
        <a href={REPO} className="hover:text-foreground">
          Source and setup on GitHub
        </a>
      </footer>
    </div>
  );
}
