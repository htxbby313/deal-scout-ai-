import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type EngagementChannel } from "@prisma/client";
import { evaluateEngagementGate, evaluateProviderReadiness } from "@/lib/engagement-safety-policy";
import { getPrisma } from "@/lib/prisma";

function recipientHash(value: string) {
  const pepper = process.env.CONTACT_HASH_PEPPER;
  if (!pepper) throw new Error("CONTACT_HASH_PEPPER is required before seller engagement records can be created.");
  return createHash("sha256").update(`${pepper}:${value.trim().toLowerCase()}`).digest("hex");
}

async function audit(tx: Prisma.TransactionClient, transactionId: string, type: string, actor: string, summary: string, details?: Prisma.InputJsonValue) {
  const latest = await tx.transactionAuditEvent.findFirst({ where: { transactionId }, orderBy: { sequence: "desc" }, select: { sequence: true } });
  return tx.transactionAuditEvent.create({ data: { transactionId, sequence: (latest?.sequence ?? 0) + 1, type, actor, summary, details } });
}

export async function createSellerEngagementDraft(input: { transactionId: string; channel: EngagementChannel; recipient: string; recipientLabel?: string; purpose: string; actor: string }) {
  if (!input.purpose.trim()) throw new Error("An engagement purpose is required.");
  return getPrisma().$transaction(async (tx) => {
    const transaction = await tx.dealTransaction.findUnique({ where: { id: input.transactionId } });
    if (!transaction) throw new Error("Transaction not found.");
    if (transaction.controlStatus === "STOPPED") throw new Error("A stopped transaction cannot create seller engagement.");
    const engagement = await tx.sellerEngagement.create({ data: { transactionId: transaction.id, channel: input.channel, recipientHash: recipientHash(input.recipient), recipientLabel: input.recipientLabel, jurisdictionState: transaction.jurisdictionState, purpose: input.purpose.trim(), status: "DRAFT" } });
    await audit(tx, transaction.id, "seller.engagement.drafted", input.actor, `Drafted ${input.channel} seller engagement; no delivery is authorized.`, { engagementId: engagement.id });
    return engagement;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function recordContactSuppression(input: { recipient: string; channel: EngagementChannel; jurisdictionState?: string; reason: string; source: string }) {
  if (!input.reason.trim() || !input.source.trim()) throw new Error("Suppression reason and source are required.");
  return getPrisma().contactSuppression.create({ data: { recipientHash: recipientHash(input.recipient), channel: input.channel, jurisdictionState: input.jurisdictionState?.toUpperCase(), reason: input.reason.trim(), source: input.source.trim() } });
}

export async function recordContactConsent(input: { engagementId: string; channel: EngagementChannel; status: "GRANTED" | "DENIED" | "REVOKED" | "EXPIRED"; capturedAt: Date; evidenceUrl?: string; evidenceNote?: string; expiresAt?: Date; actor: string }) {
  if (!input.evidenceUrl && !input.evidenceNote?.trim()) throw new Error("Consent evidence is required.");
  return getPrisma().$transaction(async (tx) => {
    const engagement = await tx.sellerEngagement.findUnique({ where: { id: input.engagementId } });
    if (!engagement) throw new Error("Seller engagement not found.");
    const consent = await tx.contactConsent.create({ data: { engagementId: input.engagementId, channel: input.channel, status: input.status, capturedAt: input.capturedAt, evidenceUrl: input.evidenceUrl, evidenceNote: input.evidenceNote?.trim(), expiresAt: input.expiresAt } });
    await audit(tx, engagement.transactionId, "seller.consent.recorded", input.actor, `Recorded ${input.channel} consent status ${input.status}.`, { engagementId: engagement.id, consentId: consent.id });
    return consent;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function evaluateSellerEngagement(engagementId: string) {
  const db = getPrisma();
  const engagement = await db.sellerEngagement.findUnique({ where: { id: engagementId }, include: { transaction: true, consents: { orderBy: { capturedAt: "desc" }, take: 1 } } });
  if (!engagement) throw new Error("Seller engagement not found.");
  const [suppression, policy, providers] = await Promise.all([
    db.contactSuppression.findFirst({ where: { recipientHash: engagement.recipientHash, channel: engagement.channel, effectiveAt: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { effectiveAt: "desc" } }),
    db.stateChannelPolicy.findUnique({ where: { jurisdictionState_channel: { jurisdictionState: engagement.jurisdictionState, channel: engagement.channel } } }),
    db.providerIntegrationReadiness.findMany({ where: { channel: engagement.channel } }),
  ]);
  const providerReady = providers.some((provider) => provider.status === "READY" && evaluateProviderReadiness(provider).ready);
  return evaluateEngagementGate({ transactionControl: engagement.transaction.controlStatus, transactionState: engagement.transaction.jurisdictionState, engagementState: engagement.jurisdictionState, channel: engagement.channel, ownerApproved: Boolean(engagement.ownerApprovedAt), suppressed: Boolean(suppression), consentStatus: engagement.consents[0]?.status, consentExpiresAt: engagement.consents[0]?.expiresAt, statePolicy: policy, providerReady });
}

export async function markEngagementForOwnerReview(engagementId: string, actor: string) {
  const gate = await evaluateSellerEngagement(engagementId);
  const db = getPrisma();
  const engagement = await db.sellerEngagement.findUniqueOrThrow({ where: { id: engagementId } });
  const blockersBeforeOwnerReview = gate.reasons.filter((reason) => reason !== "Owner approval is required.");
  const status = blockersBeforeOwnerReview.length === 0 ? "READY_FOR_OWNER_REVIEW" : "BLOCKED";
  await db.$transaction(async (tx) => {
    await tx.sellerEngagement.update({ where: { id: engagementId }, data: { status } });
    await audit(tx, engagement.transactionId, "seller.engagement.evaluated", actor, status === "READY_FOR_OWNER_REVIEW" ? "Seller engagement passed automated checks and awaits owner review." : "Seller engagement remains blocked.", { engagementId, reasons: gate.reasons });
  });
  return { status, reasons: gate.reasons };
}

export const __sellerEngagementTestables = { recipientHash };
