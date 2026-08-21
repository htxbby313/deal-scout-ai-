import "server-only";
import {
  Prisma,
  type EngagementChannel,
  type SellerAuthorityStatus,
  type SellerDispositionReason,
  type SellerRepresentationStatus,
} from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { validateSellerFacts } from "@/lib/seller-crm-policy";
import {
  classifyContactAttempt,
  humanize,
  paginateTimelineThroughPage,
  type SellerTimelineEvent,
} from "@/lib/seller-crm-domain";

const https = (raw?: string) => {
  if (!raw) return undefined;
  const url = new URL(raw);
  if (url.protocol !== "https:")
    throw new Error("Evidence URLs must use HTTPS.");
  return url.toString();
};
export async function recordSellerConversation(input: {
  engagementId: string;
  contactAttemptId?: string;
  occurredAt: Date;
  sourceType: string;
  sourceUrl?: string;
  sourceArtifactHash?: string;
  summary: string;
  objections: string[];
  questions: string[];
  actor: string;
}) {
  if (input.summary.trim().length < 10 || input.occurredAt > new Date())
    throw new Error("A dated, meaningful conversation summary is required.");
  const { actor, ...data } = input;
  return getPrisma().sellerConversation.create({
    data: { ...data, sourceUrl: https(data.sourceUrl), recordedBy: actor },
  });
}
export async function recordSellerFacts(input: {
  engagementId: string;
  conversationId: string;
  priorities: string[];
  timeline?: string;
  propertyCondition?: string;
  desiredProceedsCents?: bigint;
  minimumNetProceedsCents?: bigint;
  authorityStatus: SellerAuthorityStatus;
  authoritySourceUrl?: string;
  representationStatus: SellerRepresentationStatus;
  preferredChannel?: EngagementChannel;
  independentAdviceOfferedAt?: Date;
  sellerStatedAt: Date;
  actor: string;
  correctionReason?: string;
  independentAdviceRequired: boolean;
}) {
  const db = getPrisma();
  const conversation = await db.sellerConversation.findFirst({
    where: { id: input.conversationId, engagementId: input.engagementId },
  });
  if (!conversation) throw new Error("Source conversation not found.");
  const decision = validateSellerFacts({
    ...input,
    conversationOccurredAt: conversation.occurredAt,
    now: new Date(),
  });
  if (!decision.valid)
    throw new Error(`Seller facts blocked: ${decision.blockers.join(", ")}`);
  return db.$transaction(
    async (tx) => {
      const latest = await tx.sellerFactVersion.findFirst({
        where: { engagementId: input.engagementId },
        orderBy: { version: "desc" },
      });
      const { actor, independentAdviceRequired: _required, ...data } = input;
      void _required;
      return tx.sellerFactVersion.create({
        data: {
          ...data,
          authoritySourceUrl: https(data.authoritySourceUrl),
          recordedBy: actor,
          version: (latest?.version ?? 0) + 1,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function scheduleSellerFollowUp(input: {
  engagementId: string;
  dueAt: Date;
  reason: string;
  channel?: EngagementChannel;
  actor: string;
}) {
  const db = getPrisma();
  const engagement = await db.sellerEngagement.findUniqueOrThrow({
    where: { id: input.engagementId },
  });
  const suppression = await db.contactSuppression.findFirst({
    where: {
      recipientHash: engagement.recipientHash,
      channel: input.channel ?? engagement.channel,
      effectiveAt: { lte: new Date() },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  return db.sellerFollowUp.create({
    data: {
      engagementId: input.engagementId,
      dueAt: input.dueAt,
      reason: input.reason,
      channel: input.channel,
      createdBy: input.actor,
      status: suppression ? "SUPPRESSED" : "SCHEDULED",
    },
  });
}
export async function recordSellerDisposition(input: {
  engagementId: string;
  reason: SellerDispositionReason;
  explanation?: string;
  nurtureUntil?: Date;
  actor: string;
}) {
  if (input.reason === "OTHER" && !input.explanation?.trim())
    throw new Error("Other dispositions require an explanation.");
  return getPrisma().sellerLeadDisposition.create({
    data: {
      engagementId: input.engagementId,
      reason: input.reason,
      explanation: input.explanation,
      nurtureUntil: input.nurtureUntil,
      decidedBy: input.actor,
    },
  });
}
export async function readSellerCrm() {
  return getPrisma().sellerEngagement.findMany({
    include: {
      transaction: { include: { property: true } },
      conversations: { orderBy: { occurredAt: "desc" }, take: 5 },
      sellerFacts: { orderBy: { version: "desc" }, take: 1 },
      followUps: {
        where: { status: { in: ["DUE", "SCHEDULED"] } },
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
        take: 5,
      },
      offerHistory: { orderBy: { version: "desc" }, take: 3 },
      dispositions: { orderBy: { decidedAt: "desc" }, take: 1 },
      contactAttempts: { orderBy: { createdAt: "desc" }, take: 5 },
      consents: { orderBy: { capturedAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function readSellerTimeline(
  engagementId: string,
  page = 0,
  pageSize = 20,
) {
  const db = getPrisma();
  const engagement = await db.sellerEngagement.findUnique({
    where: { id: engagementId },
    select: { id: true },
  });
  if (!engagement) throw new Error("Seller engagement not found.");
  const take = (Math.max(0, page) + 1) * pageSize + 1;
  const [
    conversations,
    attempts,
    followUps,
    offers,
    dispositions,
    facts,
    consents,
  ] = await Promise.all([
    db.sellerConversation.findMany({
      where: { engagementId },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take,
    }),
    db.sellerContactAttempt.findMany({
      where: { engagementId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    }),
    db.sellerFollowUp.findMany({
      where: { engagementId },
      orderBy: [{ dueAt: "desc" }, { id: "desc" }],
      take,
    }),
    db.sellerOfferHistory.findMany({
      where: { engagementId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    }),
    db.sellerLeadDisposition.findMany({
      where: { engagementId },
      orderBy: [{ decidedAt: "desc" }, { id: "desc" }],
      take,
    }),
    db.sellerFactVersion.findMany({
      where: { engagementId },
      orderBy: [{ sellerStatedAt: "desc" }, { id: "desc" }],
      take,
    }),
    db.contactConsent.findMany({
      where: { engagementId },
      orderBy: [{ capturedAt: "desc" }, { id: "desc" }],
      take,
    }),
  ]);
  const details = (label: string, values: string[]) =>
    values.length
      ? `\n${label}:\n${values.map((value) => `- ${value}`).join("\n")}`
      : "";
  const events: SellerTimelineEvent[] = [
    ...conversations.map((row) => ({
      id: `conversation-${row.id}`,
      at: row.occurredAt,
      type: row.sourceType,
      body: `${row.summary}${details("Seller objections", row.objections)}${details("Seller questions", row.questions)}`,
      status: "Recorded",
      presentation: "inbound" as const,
      accessibilityLabel: "Sourced seller conversation",
    })),
    ...attempts.map(classifyContactAttempt),
    ...followUps.map((row) => ({
      id: `followup-${row.id}`,
      at: row.dueAt,
      type: "Follow-up",
      body: row.reason,
      status: humanize(row.status),
      presentation: "system" as const,
      accessibilityLabel: "Follow-up workflow event",
    })),
    ...offers.map((row) => ({
      id: `offer-${row.id}`,
      at: row.createdAt,
      type: "Offer",
      body: `${(Number(row.offerPriceCents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} offer`,
      status: humanize(row.status),
      presentation: "system" as const,
      accessibilityLabel: "Offer workflow event",
    })),
    ...dispositions.map((row) => ({
      id: `disposition-${row.id}`,
      at: row.decidedAt,
      type: "Disposition",
      body: row.explanation || humanize(row.reason),
      status: humanize(row.reason),
      presentation: "system" as const,
      accessibilityLabel: "Disposition event",
    })),
    ...facts.map((row) => ({
      id: `facts-${row.id}`,
      at: row.sellerStatedAt,
      type: "Seller facts",
      body: row.priorities.length
        ? row.priorities.join("; ")
        : "Seller facts version recorded.",
      status: humanize(row.authorityStatus),
      presentation: "system" as const,
      accessibilityLabel: "Seller facts workflow event",
    })),
    ...consents.map((row) => ({
      id: `consent-${row.id}`,
      at: row.capturedAt,
      type: "Consent",
      body:
        row.evidenceNote ||
        `Consent status recorded for ${humanize(row.channel)}.`,
      status: humanize(row.status),
      presentation: "system" as const,
      accessibilityLabel: "Consent evidence event",
    })),
  ];
  return paginateTimelineThroughPage(events, page, pageSize);
}
