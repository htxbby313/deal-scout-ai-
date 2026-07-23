import { NextResponse } from "next/server";

import { runFollowUpScheduler } from "@/lib/database";

export async function POST() {
  const result = runFollowUpScheduler();
  return NextResponse.json({ ok: true, ...result });
}
