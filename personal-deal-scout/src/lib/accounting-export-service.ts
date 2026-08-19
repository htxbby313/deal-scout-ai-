import "server-only";
import { serializeAccountingCsv, type AccountingExportRow } from "@/lib/accounting-export";
import { getPrisma } from "@/lib/prisma";

type CorrectionFields = { closingDate?: string; sellerProceeds?: number; assignmentFee?: number; transactionCosts?: number };

export async function exportSettlementAccountingCsv(input: { from: Date; to: Date }) {
  if (input.from > input.to) throw new Error("Export start must be before export end.");
  const artifacts = await getPrisma().settlementArtifact.findMany({ where: { closingDate: { gte: input.from, lte: input.to } }, include: { corrections: { orderBy: { createdAt: "asc" } } }, orderBy: [{ closingDate: "asc" }, { id: "asc" }] });
  const rows: AccountingExportRow[] = artifacts.map((artifact) => {
    const effective = artifact.corrections.reduce<CorrectionFields>((current, correction) => ({ ...current, ...(correction.correctedFields as CorrectionFields) }), { closingDate: artifact.closingDate.toISOString(), sellerProceeds: artifact.sellerProceeds ?? undefined, assignmentFee: artifact.assignmentFee ?? undefined, transactionCosts: artifact.transactionCosts ?? undefined });
    return { transactionId: artifact.transactionId, settlementArtifactId: artifact.id, artifactHash: artifact.artifactHash, reviewer: artifact.reviewer, reviewedAt: artifact.reviewedAt.toISOString(), closingDate: effective.closingDate ?? artifact.closingDate.toISOString(), sellerProceeds: effective.sellerProceeds, assignmentFee: effective.assignmentFee, transactionCosts: effective.transactionCosts, correctionCount: artifact.corrections.length };
  });
  return serializeAccountingCsv(rows);
}
