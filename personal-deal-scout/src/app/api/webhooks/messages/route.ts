import { recordWebhook } from "@/lib/database";
import { verifyWebhookSignature, webhookEvidence } from "@/lib/webhook-security";

export async function POST(request: Request) {
  const body = await request.text();
  if (!verifyWebhookSignature(body, request.headers.get("x-deal-scout-signature"), process.env.WEBHOOK_SECRET)) return Response.json({ ok: false, error: "Webhook verification failed" }, { status: 401 });
  try { JSON.parse(body); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
  const result = await recordWebhook("message", webhookEvidence(body, request.headers.get("x-webhook-id"), request.headers.get("x-provider-id")));
  return Response.json({ ok: true, received: "message", ...result });
}
