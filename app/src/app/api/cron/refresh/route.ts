import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runRefresh } from "@/lib/refresh/run";

// Downloading the 311 file and rebuilding takes ~10 s locally; leave room for a slow city server.
export const maxDuration = 300;

const secretMatches = (given: string, secret: string) => {
  const a = Buffer.from(given), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

// Vercel Cron calls this nightly (vercel.json) with "Authorization: Bearer $CRON_SECRET".
// Without CRON_SECRET set it refuses everyone, so a misconfigured deploy is closed, not open.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!secretMatches(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "not allowed" }, { status: 401 });
  }
  const { status, run } = await runRefresh("cron");
  if (!run.ok) console.error("refresh failed:", run.error);
  return NextResponse.json(run, { status });
}
