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
        Your photo joins the city&apos;s 311 reports for that block. Once a block reaches five reports, it shows up on the map as a hotspot.
      </p>
      <div className="mt-8">
        <ReportForm />
      </div>
    </div>
  );
}
