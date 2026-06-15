import { NextResponse } from "next/server";
import { getSnapshot } from "@/app/lib/data";

export async function GET() {
  const snapshot = await getSnapshot();
  return NextResponse.json(snapshot);
}
