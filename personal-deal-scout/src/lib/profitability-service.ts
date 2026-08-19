import "server-only";

import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { appendAuditEvent } from "@/lib/transaction-control";
import { calculateFinancialProjection, calculateSettlementReviewedProfit, financialAuditDetails, type MoneyCents, type ProjectionInput } from "@/lib/financial-truth";

type ItemizedProjection = ProjectionInput & {
  sellerAskingPriceCents?: MoneyCents;
  sellerMinimumNetCents?: MoneyCents;
  buyerPriceStatus: "DOCUMENTED" | "COMMITTED";
  buyerPriceSourceUrl: string;
  buyerPriceObservedAt: Date;
  buyerPriceExpiresAt: Date;
};

function secureUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Financial evidence must use a public HTTPS source URL.");
  return url.toString();
}

const VERSION_RETRY_LIMIT = 3;
async function withVersionRetry<T>(operation: () => Promise<T>) {
  for (let attempt = 1; attempt <= VERSION_RETRY_LIMIT; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code);
      if (!retryable || attempt === VERSION_RETRY_LIMIT) throw error;
    }
  }
  throw new Error("Financial version allocation failed.");
}

export async function createFinancialProjectionRecord(input: {
  transactionId: string;
  actor: string;
  projection: ItemizedProjection;
  evidenceNotes: string;
  correctionReason?: string;
}) {
  const now = new Date();
  const sourceUrl = secureUrl(input.projection.buyerPriceSourceUrl);
  if (input.projection.buyerPriceObservedAt > now || input.projection.buyerPriceExpiresAt <= now) throw new Error("Buyer pricing must be currently observable and unexpired.");
  if (input.evidenceNotes.trim().length < 10) throw new Error("Financial evidence notes are required.");
  const result = calculateFinancialProjection(input.projection);
  const db = getPrisma();
  return withVersionRetry(() => db.$transaction(async (tx) => {
    const transaction = await tx.dealTransaction.findUnique({ where: { id: input.transactionId } });
    if (!transaction) throw new Error("Transaction not found.");
    if (transaction.controlStatus === "STOPPED") throw new Error("Financial projections cannot be added to a stopped transaction.");
    const latest = await tx.financialProjection.findFirst({ where: { transactionId: input.transactionId }, orderBy: { version: "desc" } });
    if (latest && (!input.correctionReason || input.correctionReason.trim().length < 10)) throw new Error("A meaningful correction reason is required for a new projection version.");
    const value = (amount: bigint | undefined) => amount ?? BigInt(0);
    const record = await tx.financialProjection.create({ data: {
      transactionId: input.transactionId, version: (latest?.version ?? 0) + 1,
      sellerContractPriceCents: input.projection.sellerContractPriceCents, sellerAskingPriceCents: input.projection.sellerAskingPriceCents, sellerMinimumNetCents: input.projection.sellerMinimumNetCents,
      buyerPriceLowCents: input.projection.buyerPriceLowCents, buyerPriceBaseCents: input.projection.buyerPriceBaseCents, buyerPriceHighCents: input.projection.buyerPriceHighCents,
      buyerPriceStatus: input.projection.buyerPriceStatus, buyerPriceSourceUrl: sourceUrl, buyerPriceObservedAt: input.projection.buyerPriceObservedAt, buyerPriceExpiresAt: input.projection.buyerPriceExpiresAt,
      transactionCostsCents: input.projection.transactionCostsCents, doubleClosingCostsCents: value(input.projection.doubleClosingCostsCents), titleExpensesCents: value(input.projection.titleExpensesCents), closingExpensesCents: value(input.projection.closingExpensesCents), transactionalFundingCents: value(input.projection.transactionalFundingCents), financingCostsCents: value(input.projection.financingCostsCents), taxesCents: value(input.projection.taxesCents), liensAndPayoffsCents: value(input.projection.liensAndPayoffsCents), concessionsCents: input.projection.concessionsCents, inspectionExpensesCents: value(input.projection.inspectionExpensesCents), legalExpensesCents: value(input.projection.legalExpensesCents), dataMarketingCostsCents: value(input.projection.dataMarketingCostsCents), insuranceExpensesCents: value(input.projection.insuranceExpensesCents), otherExpensesCents: value(input.projection.otherExpensesCents), riskReserveCents: input.projection.riskReserveCents, contingencyReserveCents: value(input.projection.contingencyReserveCents), earnestMoneyDepositedCents: value(input.projection.earnestMoneyDepositedCents), earnestMoneyAtRiskCents: input.projection.earnestMoneyAtRiskCents,
      probabilityLowBps: input.projection.probabilityLowBps, probabilityBaseBps: input.projection.probabilityBaseBps, probabilityHighBps: input.projection.probabilityHighBps,
      feeLowCents: result.feeLowCents, feeBaseCents: result.feeBaseCents, feeHighCents: result.feeHighCents, probabilityWeightedCents: result.probabilityWeightedCents, sellerSafeMaximumCents: result.sellerSafeMaximumCents, targetFeeLowCents: result.targetFeeLowCents, targetFeeHighCents: result.targetFeeHighCents,
      evidence: { buyerPriceSourceUrl: sourceUrl, buyerPriceObservedAt: input.projection.buyerPriceObservedAt.toISOString(), buyerPriceExpiresAt: input.projection.buyerPriceExpiresAt.toISOString(), notes: input.evidenceNotes.trim() }, createdBy: input.actor, correctionReason: input.correctionReason?.trim(), supersedesId: latest?.id,
    } });
    await appendAuditEvent(tx, input.transactionId, "financial.projection.recorded", input.actor, `Recorded projected financial scenario version ${record.version}.`, financialAuditDetails({ recordId: record.id, version: record.version, kind: "PROJECTED", amountCents: record.feeBaseCents, correctsId: record.supersedesId }) as Prisma.InputJsonValue);
    return record;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function createSettlementReviewRecord(input: { transactionId: string; actor: string; grossAssignmentFeeCents: MoneyCents; actualExpensesCents: MoneyCents; settlementDocumentUrl: string; settlementDocumentHash: string; reviewedAt: Date; correctionReason?: string }) {
  const calculated = calculateSettlementReviewedProfit({ grossAssignmentFeeCents: input.grossAssignmentFeeCents, actualExpensesCents: input.actualExpensesCents, settlementDocumentUrl: secureUrl(input.settlementDocumentUrl), settlementDocumentHash: input.settlementDocumentHash, reviewedBy: input.actor, reviewedAt: input.reviewedAt.toISOString() });
  const db = getPrisma();
  return withVersionRetry(() => db.$transaction(async (tx) => {
    const transaction = await tx.dealTransaction.findUnique({ where: { id: input.transactionId } });
    if (!transaction) throw new Error("Transaction not found.");
    if (transaction.controlStatus === "STOPPED") throw new Error("Settlement results cannot be added to a stopped transaction.");
    const latest = await tx.settlementReview.findFirst({ where: { transactionId: input.transactionId }, orderBy: { version: "desc" } });
    if (latest && (!input.correctionReason || input.correctionReason.trim().length < 10)) throw new Error("A meaningful correction reason is required for a settlement correction.");
    const record = await tx.settlementReview.create({ data: { transactionId: input.transactionId, version: (latest?.version ?? 0) + 1, settlementDocumentUrl: input.settlementDocumentUrl, settlementDocumentHash: input.settlementDocumentHash, grossAssignmentFeeCents: input.grossAssignmentFeeCents, actualExpensesCents: input.actualExpensesCents, realizedProfitCents: calculated.realizedProfitCents, reviewedBy: input.actor, reviewedAt: input.reviewedAt, correctionReason: input.correctionReason?.trim(), correctsId: latest?.id } });
    await appendAuditEvent(tx, input.transactionId, "financial.settlement.reviewed", input.actor, `Recorded settlement-backed realized profit version ${record.version}.`, financialAuditDetails({ recordId: record.id, version: record.version, kind: "REALIZED", amountCents: record.realizedProfitCents, correctsId: record.correctsId }) as Prisma.InputJsonValue);
    return record;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export const __profitabilityServiceTestables = { VERSION_RETRY_LIMIT, withVersionRetry };

export async function readProfitabilityWorkspace() {
  const transactions = await getPrisma().dealTransaction.findMany({ include: { property: true, developer: true, financialProjections: { orderBy: { version: "desc" }, take: 1 }, settlementReviews: { orderBy: { version: "desc" }, take: 1 }, acquisitionFunnel: { include: { buyerCoverage: true, gates: true } } }, orderBy: { updatedAt: "desc" } });
  const rows = transactions.map((transaction) => { const projection = transaction.financialProjections[0]; const settlement = transaction.settlementReviews[0]; return { id: transaction.id, property: transaction.property.address, market: `${transaction.property.city}, ${transaction.property.state}`, buyer: transaction.developer?.companyName ?? null, controlStatus: transaction.controlStatus, stage: transaction.acquisitionFunnel?.stage ?? "DISCOVERED", projectedLowCents: projection?.feeLowCents.toString() ?? null, projectedBaseCents: projection?.feeBaseCents.toString() ?? null, projectedHighCents: projection?.feeHighCents.toString() ?? null, probabilityWeightedCents: projection?.probabilityWeightedCents.toString() ?? null, sellerSafeMaximumCents: projection?.sellerSafeMaximumCents.toString() ?? null, buyerPriceStatus: projection?.buyerPriceStatus ?? null, buyerPriceExpiresAt: projection?.buyerPriceExpiresAt.toISOString() ?? null, realizedProfitCents: settlement?.realizedProfitCents.toString() ?? null, realizedReviewedAt: settlement?.reviewedAt.toISOString() ?? null, buyerCoverageCount: transaction.acquisitionFunnel?.buyerCoverage.filter((item) => item.status === "CONFIRMED").length ?? 0, blockers: transaction.acquisitionFunnel?.gates.filter((gate) => !["SATISFIED", "WAIVED"].includes(gate.status)).length ?? 0 }; });
  const sum = (values: Array<string | null>) => values.reduce((total, value) => total + BigInt(value ?? 0), BigInt(0)).toString();
  return { rows, totals: { projectedPipelineCents: sum(rows.filter((row) => row.realizedProfitCents == null).map((row) => row.projectedBaseCents)), probabilityWeightedPipelineCents: sum(rows.filter((row) => row.realizedProfitCents == null).map((row) => row.probabilityWeightedCents)), realizedProfitCents: sum(rows.map((row) => row.realizedProfitCents)), closedCount: rows.filter((row) => row.realizedProfitCents != null).length } };
}
