import "server-only";
import { Prisma, type DiligenceLevel } from "@prisma/client";
import { evaluateDiligence } from "@/lib/diligence-policy";
import { getPrisma } from "@/lib/prisma";

export async function registerProfessionalDiligenceArtifact(input: { transactionId: string; category: string; artifactHash: string; sourceUrl: string; professionalName: string; professionalRole: string; verifiedAt: Date; expiresAt?: Date; notes?: string }) {
  if (!/^[a-f0-9]{64}$/i.test(input.artifactHash)) throw new Error("A SHA-256 artifact hash is required.");
  const sourceUrl = new URL(input.sourceUrl); if (sourceUrl.protocol !== "https:") throw new Error("Professional artifact sources must use HTTPS.");
  if (!input.category.trim() || !input.professionalName.trim() || !input.professionalRole.trim() || input.verifiedAt > new Date()) throw new Error("Professional artifact category, reviewer, role, and valid verification date are required.");
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    const transaction = await tx.dealTransaction.findUnique({ where: { id: input.transactionId } });
    if (!transaction || transaction.controlStatus === "STOPPED") throw new Error("An active or held transaction is required.");
    const review = await tx.diligenceReview.upsert({ where: { transactionId_level: { transactionId: input.transactionId, level: "ENHANCED" } }, update: {}, create: { transactionId: input.transactionId, level: "ENHANCED", status: "PENDING" } });
    const artifact = await tx.professionalDiligenceArtifact.create({ data: { diligenceReviewId: review.id, category: input.category.trim().toUpperCase(), artifactHash: input.artifactHash.toLowerCase(), sourceUrl: sourceUrl.toString(), professionalName: input.professionalName.trim(), professionalRole: input.professionalRole.trim(), verifiedAt: input.verifiedAt, expiresAt: input.expiresAt, notes: input.notes?.trim() } });
    const latest = await tx.transactionAuditEvent.findFirst({ where: { transactionId: input.transactionId }, orderBy: { sequence: "desc" }, select: { sequence: true } });
    await tx.transactionAuditEvent.create({ data: { transactionId: input.transactionId, sequence: (latest?.sequence ?? 0) + 1, type: "transaction.diligence.professional_artifact", actor: input.professionalName.trim(), summary: `Recorded ${artifact.category} professional diligence artifact.`, details: { artifactId: artifact.id, artifactHash: artifact.artifactHash } } });
    return artifact;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function runDiligenceReview(transactionId: string, level: DiligenceLevel, reviewer = "system") {
  const db = getPrisma();
  const transaction = await db.dealTransaction.findUnique({ where: { id: transactionId }, include: { property: { include: { researchFindings: true } }, diligenceReviews: { include: { professionalArtifacts: true } } } });
  if (!transaction) throw new Error("Transaction not found.");
  if (transaction.controlStatus === "STOPPED") throw new Error("A stopped transaction cannot advance diligence.");
  const verified = transaction.property.researchFindings.filter((finding) => finding.status === "VERIFIED" && finding.sourceUrl);
  const preliminary = transaction.diligenceReviews.find((review) => review.level === "PRELIMINARY");
  const enhanced = transaction.diligenceReviews.find((review) => review.level === "ENHANCED");
  const currentProfessionalArtifacts = enhanced?.professionalArtifacts.filter((artifact) => !artifact.expiresAt || artifact.expiresAt > new Date()) ?? [];
  const result = evaluateDiligence({ level, verifiedTopics: verified.map((finding) => finding.topic), professionalArtifactCategories: currentProfessionalArtifacts.map((artifact) => artifact.category), preliminaryStatus: preliminary?.status, sourceCount: new Set(verified.map((finding) => finding.sourceUrl)).size });
  const status = result.verified ? "VERIFIED" : "NEEDS_MANUAL_VERIFICATION";
  return db.$transaction(async (tx) => {
    const unresolvedCount = result.missingTopics.length + result.missingProfessionalArtifacts.length;
    const review = await tx.diligenceReview.upsert({ where: { transactionId_level: { transactionId, level } }, update: { status, evidenceCount: verified.length + currentProfessionalArtifacts.length, unresolvedCount, reviewer, sourceManifest: { publicSources: verified.map((finding) => ({ topic: finding.topic, sourceUrl: finding.sourceUrl, observedAt: finding.observedAt.toISOString() })), professionalArtifacts: currentProfessionalArtifacts.map((artifact) => ({ category: artifact.category, artifactHash: artifact.artifactHash, sourceUrl: artifact.sourceUrl, verifiedAt: artifact.verifiedAt.toISOString() })) }, conclusion: result.verified ? (level === "PRELIMINARY" ? "Required preliminary public-record topics are present; this is not a title, legal, appraisal, survey, zoning, or inspection conclusion." : "Required professional verification artifacts are recorded and current; consult the underlying professionals and artifacts for conclusions.") : result.reasons.join(" "), completedAt: new Date() }, create: { transactionId, level, status, evidenceCount: verified.length + currentProfessionalArtifacts.length, unresolvedCount, reviewer, sourceManifest: { publicSources: verified.map((finding) => ({ topic: finding.topic, sourceUrl: finding.sourceUrl, observedAt: finding.observedAt.toISOString() })), professionalArtifacts: currentProfessionalArtifacts.map((artifact) => ({ category: artifact.category, artifactHash: artifact.artifactHash, sourceUrl: artifact.sourceUrl, verifiedAt: artifact.verifiedAt.toISOString() })) }, conclusion: result.verified ? (level === "PRELIMINARY" ? "Required preliminary public-record topics are present; this is not a title, legal, appraisal, survey, zoning, or inspection conclusion." : "Required professional verification artifacts are recorded and current; consult the underlying professionals and artifacts for conclusions.") : result.reasons.join(" "), startedAt: new Date(), completedAt: new Date() } });
    const latest = await tx.transactionAuditEvent.findFirst({ where: { transactionId }, orderBy: { sequence: "desc" }, select: { sequence: true } });
    await tx.transactionAuditEvent.create({ data: { transactionId, sequence: (latest?.sequence ?? 0) + 1, type: "transaction.diligence.reviewed", actor: reviewer, summary: `${level} diligence recorded as ${status}.`, details: { reviewId: review.id, missingTopics: result.missingTopics } as Prisma.InputJsonValue } });
    return review;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
