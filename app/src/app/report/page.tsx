import type { Metadata } from "next";
import { ReportForm } from "@/components/report-form";

export const metadata: Metadata = { title: "Report dumping · TipOff" };

// UI: Sarthak
export default function ReportPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-5 py-10 sm:px-8">
      <p className="font-mono text-xs tracking-[0.18em] text-hot uppercase">Report dumping</p>
      <h1 className="mt-3 font-heading text-4xl leading-none font-bold tracking-tight uppercase">Seen a pile? Send a photo.</h1>
      <p className="mt-4 text-muted-foreground">
        Report dumping in St. Louis City, Ballwin or Chesterfield. Five reports on a block create a hotspot; one photo reporter counts once per block.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">St. Louis City includes 311 history. Ballwin and Chesterfield currently use TipOff photo reports only; municipal history is not connected.</p>
      <div className="mt-8">
        <ReportForm />
      </div>
    </div>
  );
}
