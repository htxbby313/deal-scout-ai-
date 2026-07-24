import { recordWebhook } from "@/lib/database";

export async function POST(request: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Webhook not configured" }, { status: 503 });
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  await recordWebhook("message", payload);
  return Response.json({ ok: true, received: "message" });
}
