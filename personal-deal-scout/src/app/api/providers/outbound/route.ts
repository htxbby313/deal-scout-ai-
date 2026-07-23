import { NextRequest, NextResponse } from "next/server";

import { attemptProviderSend } from "@/lib/database";

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as { approvalId?: string };
  if (!payload.approvalId) {
    return NextResponse.json({ ok: false, error: "approvalId is required" }, { status: 400 });
  }

  const approval = attemptProviderSend(payload.approvalId);
  return NextResponse.json({
    ok: false,
    blocked: true,
    reason: "Outbound providers are disabled until explicitly configured and approved.",
    approval,
  });
}
