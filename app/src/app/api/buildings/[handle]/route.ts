import { NextResponse } from "next/server";
import { getBuilding } from "@/lib/buildings";

// Full record for one vacant building, for the Danger Radar side panel.
export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const building = getBuilding((await params).handle);
  if (!building) return NextResponse.json({ error: "unknown building handle" }, { status: 404 });
  return NextResponse.json(building);
}
