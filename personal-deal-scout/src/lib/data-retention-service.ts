import "server-only";
import { createHash } from "node:crypto";
import type { RetentionCategory, RetentionReviewStatus } from "@prisma/client";
import { evaluateRetentionReview } from "@/lib/data-governance-policy";
import { getPrisma } from "@/lib/prisma";

function recordIdHash(recordId: string) {
  const pepper = process.env.RETENTION_HASH_PEPPER;
  if (!pepper) throw new Error("RETENTION_HASH_PEPPER is required before retention reviews are scheduled.");
  return createHash("sha256").update(`${pepper}:${recordId}`).digest("hex");
}

export async function createInactiveRetentionPolicy(input: { category: RetentionCategory; jurisdictionState: string; retentionDays: number }) {
  if (!Number.isInteger(input.retentionDays) || input.retentionDays < 1) throw new Error("A positive retention period is required.");
  const state = input.jurisdictionState.toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) throw new Error("A two-letter jurisdiction is required.");
  const db = getPrisma();
  const latest = await db.dataRetentionPolicy.findFirst({ where: { category: input.category, jurisdictionState: state }, orderBy: { version: "desc" } });
  return db.dataRetentionPolicy.create({ data: { category: input.category, jurisdictionState: state, version: (latest?.version ?? 0) + 1, retentionDays: input.retentionDays, active: false } });
}

export async function scheduleRetentionReview(input: { policyId: string; recordType: string; recordId: string; createdAt: Date; legalHoldReason?: string }) {
  const db = getPrisma();
  const policy = await db.dataRetentionPolicy.findUnique({ where: { id: input.policyId } });
  if (!policy?.active) throw new Error("An active counsel- and owner-approved retention policy is required.");
  const dueAt = new Date(input.createdAt.getTime() + policy.retentionDays * 86_400_000);
  return db.retentionReviewRecord.upsert({ where: { policyId_recordType_recordIdHash: { policyId: policy.id, recordType: input.recordType, recordIdHash: recordIdHash(input.recordId) } }, update: {}, create: { policyId: policy.id, recordType: input.recordType, recordIdHash: recordIdHash(input.recordId), dueAt, status: input.legalHoldReason ? "LEGAL_HOLD" : "PENDING", legalHoldReason: input.legalHoldReason } });
}

export async function decideRetentionReview(input: { reviewId: string; actor: string; reason: string; requestedStatus: Exclude<RetentionReviewStatus, "PENDING"> }) {
  if (!input.actor.trim() || input.reason.trim().length < 10) throw new Error("Owner identity and a meaningful decision reason are required.");
  const db = getPrisma();
  const review = await db.retentionReviewRecord.findUnique({ where: { id: input.reviewId }, include: { policy: true } });
  if (!review) throw new Error("Retention review not found.");
  if (input.requestedStatus === "LEGAL_HOLD") {
    const held = await db.retentionReviewRecord.update({ where: { id: review.id }, data: { status: "LEGAL_HOLD", legalHoldReason: input.reason.trim(), decidedBy: input.actor.trim(), decidedAt: new Date(), decisionReason: input.reason.trim() } });
    await db.auditLog.create({ data: { type: "data.retention.legal_hold", summary: "Placed a record under legal hold; no data was deleted.", details: { reviewId: review.id, recordType: review.recordType } } });
    return { review: held, dataDeleted: false as const };
  }
  const evaluation = evaluateRetentionReview({ dueAt: review.dueAt, legalHoldReason: review.legalHoldReason, policyActive: review.policy.active });
  if (input.requestedStatus === "ELIGIBLE_FOR_MANUAL_DELETION" && evaluation.status !== "ELIGIBLE_FOR_MANUAL_DELETION") throw new Error(`Manual deletion eligibility blocked: ${evaluation.blockers.join(", ")}`);
  if (input.requestedStatus !== evaluation.status && input.requestedStatus !== "RETAIN") throw new Error("Requested retention decision conflicts with the policy evaluation.");
  const decided = await db.retentionReviewRecord.update({ where: { id: review.id }, data: { status: input.requestedStatus, decidedBy: input.actor.trim(), decidedAt: new Date(), decisionReason: input.reason.trim() } });
  await db.auditLog.create({ data: { type: "data.retention.reviewed", summary: `Recorded ${input.requestedStatus} retention decision; no data was deleted.`, details: { reviewId: review.id, recordType: review.recordType } } });
  return { review: decided, dataDeleted: false as const };
}
