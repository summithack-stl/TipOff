import { NextResponse } from "next/server";
import { connection } from "next/server";
import { rateLimit } from "@/lib/guard";
import { readStatus } from "@/lib/refresh/store";

// When the data last refreshed, whether the last try worked, and why not if it didn't. Public and
// read-only: it holds dates, counts and our own error messages, nothing about people.
export async function GET(request: Request) {
  await connection(); // the status changes between deploys, so never prerender it
  const limited = rateLimit(request, "refresh-status", 30);
  if (limited) return limited;
  const { status } = await readStatus();
  return NextResponse.json(status, { headers: { "cache-control": "no-store" } });
}
