import { enqueueAgentOperations } from "@/lib/agent-queue";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const queued = await enqueueAgentOperations("CRON");
  return Response.json({ ok: true, queueMessageId: queued.messageId, status: "queued" }, { status: 202 });
}
