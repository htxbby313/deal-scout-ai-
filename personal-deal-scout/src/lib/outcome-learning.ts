import "server-only";
import { Prisma, type LearningObservationStatus, type TransactionOutcomeStatus } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

async function audit(tx: Prisma.TransactionClient, transactionId: string, type: string, actor: string, summary: string, details?: Prisma.InputJsonValue) {
  const latest = await tx.transactionAuditEvent.findFirst({ where: { transactionId }, orderBy: { sequence: "desc" }, select: { sequence: true } });
  return tx.transactionAuditEvent.create({ data: { transactionId, sequence: (latest?.sequence ?? 0) + 1, type, actor, summary, details } });
}

export async function recordTransactionOutcome(input: { transactionId: string; status: TransactionOutcomeStatus; actor: string; sellerProceeds?: number; assignmentFee?: number; transactionCosts?: number; cycleDays?: number; cancellationReason?: string; evidence: Prisma.InputJsonValue }) {
  if (input.status === "OPEN") throw new Error("Only final outcomes may be recorded here.");
  if ([input.sellerProceeds, input.assignmentFee, input.transactionCosts, input.cycleDays].some((value) => value !== undefined && value < 0)) throw new Error("Outcome amounts and cycle time cannot be negative.");
  if ((input.status === "CANCELLED" || input.status === "FAILED") && !input.cancellationReason?.trim()) throw new Error("A cancellation or failure reason is required.");
  return getPrisma().$transaction(async (tx) => {
    const transaction = await tx.dealTransaction.findUnique({ where: { id: input.transactionId } });
    if (!transaction) throw new Error("Transaction not found.");
    const outcome = await tx.transactionOutcome.create({ data: { transactionId: input.transactionId, status: input.status, sellerProceeds: input.sellerProceeds, assignmentFee: input.assignmentFee, transactionCosts: input.transactionCosts, cycleDays: input.cycleDays, cancellationReason: input.cancellationReason?.trim(), evidence: input.evidence, finalizedAt: new Date() } });
    await audit(tx, input.transactionId, "transaction.outcome.finalized", input.actor, `Recorded final transaction outcome ${input.status}.`, { outcomeId: outcome.id });
    return outcome;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function recordLearningObservation(input: { outcomeId: string; metric: string; observedValue?: number; hypothesis: string; evidence?: Prisma.InputJsonValue }) {
  if (!input.metric.trim() || !input.hypothesis.trim()) throw new Error("Metric and hypothesis are required.");
  return getPrisma().learningObservation.create({ data: { outcomeId: input.outcomeId, metric: input.metric.trim(), observedValue: input.observedValue, hypothesis: input.hypothesis.trim(), evidence: input.evidence, appliedAutomatically: false } });
}

export async function reviewLearningObservation(input: { observationId: string; status: Exclude<LearningObservationStatus, "OBSERVED">; owner: string }) {
  if (!input.owner.trim()) throw new Error("Owner identity is required.");
  return getPrisma().learningObservation.update({ where: { id: input.observationId }, data: { status: input.status, ownerReviewedAt: new Date(), ownerReviewedBy: input.owner.trim(), appliedAutomatically: false } });
}

export async function readOutcomeLearningSummary() {
  const db = getPrisma();
  const [outcomes, observations] = await Promise.all([
    db.transactionOutcome.groupBy({ by: ["status"], _count: true, _sum: { assignmentFee: true, transactionCosts: true } }),
    db.learningObservation.findMany({ where: { status: { in: ["OBSERVED", "REVIEWED", "APPROVED_FOR_MANUAL_CHANGE"] } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return { outcomes, observations, policyChangesApplied: 0 };
}
