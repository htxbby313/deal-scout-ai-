import { enqueueAgentOperations } from "@/lib/agent-queue";
import { ensureAutomaticPropertyCardMedia } from "@/lib/property-card-media";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const origin = new URL(request.url).origin;
  const cardMediaPromise = ensureAutomaticPropertyCardMedia(origin, 100)
    .then((result) => ({ ...result, error: null }))
    .catch(() => ({ checked: 0, created: 0, updated: 0, error: "backfill_failed" }));
  const queued = await enqueueAgentOperations("CRON");
  const cardMedia = await cardMediaPromise;

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
