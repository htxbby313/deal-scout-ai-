import { attemptProviderSend } from "@/lib/database";
import { ownerIsAuthenticated } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await ownerIsAuthenticated())) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const payload = (await request.json().catch(() => ({}))) as { approvalId?: string };
  if (!payload.approvalId) {
    return Response.json({ ok: false, error: "approvalId is required" }, { status: 400 });
  }

  const approval = await attemptProviderSend(payload.approvalId);
  return Response.json({
    ok: false,
    blocked: true,
    reason: "Outbound remains blocked until every required control is satisfied.",
    blockers: approval.blockerCodes,
    approval,
  });
}
