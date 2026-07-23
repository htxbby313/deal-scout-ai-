import { NextRequest, NextResponse } from "next/server";

import { recordWebhook } from "@/lib/database";

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  recordWebhook("call", payload);
  return NextResponse.json({ ok: true, received: "call" });
}
