import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";

export const communicationWebhookSchema = z.object({
  targetType: z.enum(["seller", "buyer"]),
  targetId: z.string().min(1).max(200),
  direction: z.enum(["INBOUND", "OUTBOUND"]).default("INBOUND"),
  channel: z.enum(["EMAIL", "SMS", "PHONE", "WEB_CHAT"]),
  summary: z.string().trim().min(1).max(10_000),
  occurredAt: z.coerce.date().refine((value) => value <= new Date(), "occurredAt cannot be in the future"),
  providerReference: z.string().trim().min(1).max(300),
});

export async function recordCommunicationWebhook(input: {
  body: string;
  eventId: string;
  provider: string;
}) {
  const payload = communicationWebhookSchema.parse(JSON.parse(input.body));
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    const receiptChannel = payload.channel === "WEB_CHAT" ? "INTERNAL" : payload.channel;
    const receipt = await tx.providerWebhookReceipt.findUnique({
      where: { provider_channel_externalEventId: { provider: input.provider, channel: receiptChannel, externalEventId: input.eventId } },
    });
    if (receipt) return { duplicate: true, targetType: payload.targetType };

    await tx.providerWebhookReceipt.create({ data: {
      provider: input.provider,
      channel: receiptChannel,
      externalEventId: input.eventId,
      payloadHash: createHash("sha256").update(input.body).digest("hex"),
      byteLength: Buffer.byteLength(input.body),
    } });

    if (payload.targetType === "seller") {
      await tx.sellerEngagement.findUniqueOrThrow({ where: { id: payload.targetId }, select: { id: true } });
      await tx.sellerConversation.create({ data: {
        engagementId: payload.targetId,
        occurredAt: payload.occurredAt,
        sourceType: `${input.provider}:${payload.channel}:${payload.direction}`,
        sourceArtifactHash: createHash("sha256").update(`${input.provider}:${payload.providerReference}`).digest("hex"),
        summary: payload.summary,
        objections: [],
        questions: [],
        recordedBy: `provider:${input.provider}`,
      } });
    } else {
      await tx.developer.findUniqueOrThrow({ where: { id: payload.targetId }, select: { id: true } });
      await tx.buyerConversation.create({ data: {
        developerId: payload.targetId,
        direction: payload.direction,
        channel: payload.channel,
        summary: payload.summary,
        providerReference: `${input.provider}:${payload.providerReference}`,
        occurredAt: payload.occurredAt,
        recordedBy: `provider:${input.provider}`,
      } });
    }

    await tx.auditLog.create({ data: {
      type: `${payload.targetType}.conversation.webhook`,
      summary: `Recorded verified ${payload.direction.toLowerCase()} ${payload.channel.toLowerCase()} in the ${payload.targetType} relationship timeline.`,
      details: { targetId: payload.targetId, provider: input.provider, externalEventId: input.eventId },
    } });
    return { duplicate: false, targetType: payload.targetType };
  });
}
