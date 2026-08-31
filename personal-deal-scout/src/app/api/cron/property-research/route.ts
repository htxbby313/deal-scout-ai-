import { enqueueAgentOperations } from "@/lib/agent-queue";
import { ensureAutomaticPropertyCardMedia } from "@/lib/property-card-media";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const origin = new URL(request.url).origin;
  const [queued, cardMedia] = await Promise.all([
    enqueueAgentOperations("CRON"),
    ensureAutomaticPropertyCardMedia(origin, 100),
  ]);

  return Response.json(
    {
      ok: true,
      queueMessageId: queued.messageId,
      status: "queued",
      cardMedia,
    },
    { status: 202 },
  );
}
