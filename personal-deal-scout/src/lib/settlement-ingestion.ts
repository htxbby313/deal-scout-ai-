import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { validateSettlementFields, type SettlementFields } from "@/lib/settlement-policy";

export type ReviewedSettlementArtifact = SettlementFields & {
  transactionId: string;
  content: Uint8Array;
  storageKey?: string;
  sourceUrl?: string;
  reviewer: string;
  reviewedAt: Date;
};

export type SettlementArtifactAdapter = {
  loadReviewedArtifact(reference: string): Promise<ReviewedSettlementArtifact>;
};

const hashArtifact = (content: Uint8Array) => createHash("sha256").update(content).digest("hex");

async function audit(tx: Prisma.TransactionClient, transactionId: string, type: string, actor: string, summary: string, details: Prisma.InputJsonValue) {
  const latest = await tx.transactionAuditEvent.findFirst({ where: { transactionId }, orderBy: { sequence: "desc" }, select: { sequence: true } });
  return tx.transactionAuditEvent.create({ data: { transactionId, sequence: (latest?.sequence ?? 0) + 1, type, actor, summary, details } });
}

export async function ingestReviewedSettlement(adapter: SettlementArtifactAdapter, reference: string) {
  const artifact = await adapter.loadReviewedArtifact(reference);
  if (!artifact.reviewer.trim()) throw new Error("A human reviewer is required.");
  if (artifact.reviewedAt > new Date()) throw new Error("Review date cannot be in the future.");
  if (!artifact.storageKey && !artifact.sourceUrl) throw new Error("A durable artifact location is required.");
  if (artifact.content.byteLength === 0) throw new Error("Settlement artifact is empty.");
  const validation = validateSettlementFields(artifact);
  if (!validation.valid) throw new Error(validation.reasons.join(" "));
  const artifactHash = hashArtifact(artifact.content);
  const db = getPrisma();
  const existing = await db.settlementArtifact.findUnique({ where: { artifactHash } });
  if (existing) {
    if (existing.transactionId !== artifact.transactionId) throw new Error("Artifact hash already belongs to another transaction.");
    return { created: false as const, artifact: existing };
  }
  try {
    return await db.$transaction(async (tx) => {
      const transaction = await tx.dealTransaction.findUnique({ where: { id: artifact.transactionId } });
      if (!transaction) throw new Error("Transaction not found.");
      const created = await tx.settlementArtifact.create({ data: { transactionId: artifact.transactionId, artifactHash, storageKey: artifact.storageKey, sourceUrl: artifact.sourceUrl, reviewer: artifact.reviewer.trim(), reviewedAt: artifact.reviewedAt, closingDate: artifact.closingDate, sellerProceeds: artifact.sellerProceeds, assignmentFee: artifact.assignmentFee, transactionCosts: artifact.transactionCosts } });
      await audit(tx, artifact.transactionId, "settlement.artifact.ingested", artifact.reviewer, "Ingested reviewed settlement evidence.", { settlementArtifactId: created.id, artifactHash });
      return { created: true as const, artifact: created };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const duplicate = await db.settlementArtifact.findUniqueOrThrow({ where: { artifactHash } });
      if (duplicate.transactionId !== artifact.transactionId) throw new Error("Artifact hash already belongs to another transaction.");
      return { created: false as const, artifact: duplicate };
    }
    throw error;
  }
}

export async function addSettlementCorrection(input: { settlementArtifactId: string; correctedFields: Partial<SettlementFields>; reason: string; reviewer: string; reviewedAt: Date }) {
  if (!input.reason.trim() || !input.reviewer.trim()) throw new Error("Correction reason and reviewer are required.");
  if (Object.keys(input.correctedFields).length === 0) throw new Error("At least one corrected field is required.");
  if (input.reviewedAt > new Date()) throw new Error("Review date cannot be in the future.");
  const base = { closingDate: input.correctedFields.closingDate ?? new Date(0), sellerProceeds: input.correctedFields.sellerProceeds, assignmentFee: input.correctedFields.assignmentFee, transactionCosts: input.correctedFields.transactionCosts };
  const validation = validateSettlementFields(base);
  const relevantReasons = validation.reasons.filter((reason) => reason !== "At least one reviewed settlement amount is required.");
  if (relevantReasons.length) throw new Error(relevantReasons.join(" "));
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    const artifact = await tx.settlementArtifact.findUnique({ where: { id: input.settlementArtifactId } });
    if (!artifact) throw new Error("Settlement artifact not found.");
    const correctedFields = { ...input.correctedFields, closingDate: input.correctedFields.closingDate?.toISOString() } as Prisma.InputJsonValue;
    const correction = await tx.settlementCorrection.create({ data: { settlementArtifactId: artifact.id, correctedFields, reason: input.reason.trim(), reviewer: input.reviewer.trim(), reviewedAt: input.reviewedAt } });
    await audit(tx, artifact.transactionId, "settlement.correction.added", input.reviewer, "Added a reviewed settlement correction without changing original evidence.", { settlementArtifactId: artifact.id, correctionId: correction.id });
    return correction;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export const __settlementIngestionTestables = { hashArtifact };
