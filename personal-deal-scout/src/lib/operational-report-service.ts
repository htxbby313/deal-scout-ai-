import "server-only";

import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { buildOperationalKpis } from "@/lib/operational-kpis";

export type OperationalReportFilters = {
  start?: string;
  end?: string;
  state?: string;
  county?: string;
  zip?: string;
  stage?: string;
  buyerId?: string;
  agentId?: string;
};

function validDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function readOperationalReport(filters: OperationalReportFilters = {}, now = new Date()) {
  const db = getPrisma();
  const windowStart = validDate(filters.start, new Date(now.getTime() - 30 * 86_400_000));
  const windowEnd = validDate(filters.end, now);
  const propertyWhere: Prisma.PropertyWhereInput = {
    createdAt: { gte: windowStart, lte: windowEnd },
    ...(filters.state ? { state: { equals: filters.state, mode: "insensitive" } } : {}),
    ...(filters.county ? { county: { equals: filters.county, mode: "insensitive" } } : {}),
    ...(filters.zip ? { zipCode: filters.zip } : {}),
  };
  const funnelWhere: Prisma.AcquisitionFunnelWhereInput = {
    property: propertyWhere,
    ...(filters.stage ? { stage: filters.stage as Prisma.EnumAcquisitionStageFilter["equals"] } : {}),
    ...(filters.buyerId ? { buyerCoverage: { some: { demandVersion: { developerId: filters.buyerId } } } } : {}),
  };
  const transactionWhere: Prisma.DealTransactionWhereInput = { property: propertyWhere };

  const [properties, funnels, engagements, transactions, outcomes, buyerEvidence, costs, projections, scores, settlements, evidence, approvals, agentTasks] = await Promise.all([
    db.property.findMany({ where: propertyWhere, select: { createdAt: true, researchRuns: { select: { status: true } }, researchFindings: { select: { status: true } } } }),
    db.acquisitionFunnel.findMany({ where: funnelWhere, select: { createdAt: true, stage: true, stageEnteredAt: true, stageHistory: { select: { fromStage: true, toStage: true, occurredAt: true, exitedAt: true } } } }),
    db.sellerEngagement.findMany({ where: { transaction: transactionWhere }, select: { createdAt: true, ownerApprovedAt: true, contactAttempts: { select: { status: true, attemptedAt: true } }, conversations: { select: { occurredAt: true } }, offerHistory: { select: { status: true, createdAt: true, deliveredAt: true } } } }),
    db.dealTransaction.findMany({ where: transactionWhere, select: { id: true, createdAt: true, status: true, controlStatus: true } }),
    db.transactionOutcome.findMany({ where: { transaction: transactionWhere }, select: { createdAt: true, status: true, cancellationReason: true } }),
    db.buyerReliabilityEvidence.findMany({ where: { status: "VERIFIED", ...(filters.buyerId ? { developerId: filters.buyerId } : {}) }, select: { completedClosings: true, failedClosings: true, retrades: true, responsesMeasured: true } }),
    db.campaignCostEntry.findMany({ where: { incurredAt: { gte: windowStart, lte: windowEnd } }, select: { type: true, amountCents: true } }),
    db.financialProjection.findMany({ where: { transaction: transactionWhere }, orderBy: { version: "desc" }, select: { transactionId: true, version: true, feeBaseCents: true, probabilityWeightedCents: true } }),
    db.profitPriorityScoreHistory.findMany({ where: { funnel: funnelWhere }, orderBy: { version: "desc" }, select: { funnelId: true, version: true, contractedFeeCents: true } }),
    db.settlementReview.findMany({ where: { transaction: transactionWhere }, orderBy: { version: "desc" }, select: { transactionId: true, version: true, realizedProfitCents: true } }),
    db.propertyResearchFinding.findMany({ where: { property: propertyWhere }, select: { status: true, observedAt: true } }),
    db.transactionApproval.findMany({ where: { transaction: transactionWhere }, select: { status: true, requestedAt: true } }),
    db.agentTask.findMany({ where: { createdAt: { gte: windowStart, lte: windowEnd }, ...(filters.agentId ? { assignedAgentId: filters.agentId } : {}) }, select: { status: true, attemptCount: true, createdAt: true } }),
  ]);

  const latest = <T extends { version: number }>(rows: T[], key: (row: T) => string) => [...rows.reduce((map, row) => {
    const current = map.get(key(row));
    if (!current || row.version > current.version) map.set(key(row), row);
    return map;
  }, new Map<string, T>()).values()];
  const latestProjections = latest(projections, (row) => row.transactionId);
  const latestScores = latest(scores, (row) => row.funnelId);
  const latestSettlements = latest(settlements, (row) => row.transactionId);
  const sum = (values: bigint[]) => values.reduce((total, value) => total + value, BigInt(0));

  return buildOperationalKpis({
    properties: properties.map((item) => ({ createdAt: item.createdAt, researched: item.researchRuns.some((run) => run.status === "COMPLETED"), researchException: item.researchFindings.some((finding) => finding.status !== "VERIFIED") })),
    funnels,
    engagements: engagements.map((item) => ({ createdAt: item.createdAt, ownerApproved: Boolean(item.ownerApprovedAt), attempts: item.contactAttempts, conversations: item.conversations, offers: item.offerHistory })),
    transactions,
    outcomes: outcomes.map((item) => ({ createdAt: item.createdAt, closed: item.status === "CLOSED_ASSIGNED" || item.status === "CLOSED_PURCHASED", reason: item.cancellationReason })),
    buyerEvidence,
    costs,
    profits: {
      projectedCents: sum(latestProjections.map((item) => item.feeBaseCents)),
      weightedCents: sum(latestProjections.map((item) => item.probabilityWeightedCents)),
      contractedCents: sum(latestScores.flatMap((item) => item.contractedFeeCents == null ? [] : [item.contractedFeeCents])),
      realizedCents: sum(latestSettlements.map((item) => item.realizedProfitCents)),
      realizedValues: latestSettlements.map((item) => item.realizedProfitCents),
    },
    evidence,
    approvals,
    agentTasks,
    windowStart,
    windowEnd,
    refreshedAt: now,
  });
}
