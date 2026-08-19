import "server-only";
import { Prisma, type DiligenceLevel } from "@prisma/client";
import { evaluateDiligence } from "@/lib/diligence-policy";
import { getPrisma } from "@/lib/prisma";

export async function runDiligenceReview(transactionId: string, level: DiligenceLevel, reviewer = "system") {
  const db = getPrisma();
  const transaction = await db.dealTransaction.findUnique({ where: { id: transactionId }, include: { property: { include: { researchFindings: true } }, diligenceReviews: true } });
  if (!transaction) throw new Error("Transaction not found.");
  if (transaction.controlStatus === "STOPPED") throw new Error("A stopped transaction cannot advance diligence.");
  const verified = transaction.property.researchFindings.filter((finding) => finding.status === "VERIFIED" && finding.sourceUrl);
  const preliminary = transaction.diligenceReviews.find((review) => review.level === "PRELIMINARY");
  const result = evaluateDiligence({ level, verifiedTopics: verified.map((finding) => finding.topic), preliminaryStatus: preliminary?.status, sourceCount: new Set(verified.map((finding) => finding.sourceUrl)).size });
  const status = result.verified ? "VERIFIED" : "NEEDS_MANUAL_VERIFICATION";
  return db.$transaction(async (tx) => {
    const review = await tx.diligenceReview.upsert({ where: { transactionId_level: { transactionId, level } }, update: { status, evidenceCount: verified.length, unresolvedCount: result.missingTopics.length, reviewer, sourceManifest: verified.map((finding) => ({ topic: finding.topic, sourceUrl: finding.sourceUrl, observedAt: finding.observedAt.toISOString() })), conclusion: result.verified ? "Required source-backed diligence topics are present; this is not a title, legal, appraisal, or survey conclusion." : result.reasons.join(" "), completedAt: new Date() }, create: { transactionId, level, status, evidenceCount: verified.length, unresolvedCount: result.missingTopics.length, reviewer, sourceManifest: verified.map((finding) => ({ topic: finding.topic, sourceUrl: finding.sourceUrl, observedAt: finding.observedAt.toISOString() })), conclusion: result.verified ? "Required source-backed diligence topics are present; this is not a title, legal, appraisal, or survey conclusion." : result.reasons.join(" "), startedAt: new Date(), completedAt: new Date() } });
    const latest = await tx.transactionAuditEvent.findFirst({ where: { transactionId }, orderBy: { sequence: "desc" }, select: { sequence: true } });
    await tx.transactionAuditEvent.create({ data: { transactionId, sequence: (latest?.sequence ?? 0) + 1, type: "transaction.diligence.reviewed", actor: reviewer, summary: `${level} diligence recorded as ${status}.`, details: { reviewId: review.id, missingTopics: result.missingTopics } as Prisma.InputJsonValue } });
    return review;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
