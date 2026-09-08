import { recordCommunicationWebhook } from "@/lib/communication-webhook";
import { verifyWebhookSignature } from "@/lib/webhook-security";

export async function POST(request: Request) {
  const body = await request.text();
  if (!verifyWebhookSignature(body, request.headers.get("x-deal-scout-signature"), process.env.WEBHOOK_SECRET)) return Response.json({ ok: false, error: "Webhook verification failed" }, { status: 401 });
  const eventId = request.headers.get("x-webhook-id");
  if (!eventId) return Response.json({ ok: false, error: "Stable webhook event ID required" }, { status: 400 });
  try {
    const result = await recordCommunicationWebhook({ body, eventId, provider: request.headers.get("x-provider-id") || "unidentified" });
    return Response.json({ ok: true, received: "call", ...result });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Invalid communication webhook" }, { status: 400 });
  }
}
