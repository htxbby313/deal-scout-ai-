import "server-only";
import { getPrisma } from "@/lib/prisma";
import { buildExecutiveKpis } from "@/lib/executive-kpis";

export async function readExecutiveKpis(now = new Date()) {
  const db = getPrisma();
  const [transactions, projections, settlements, contractedScores, funnels, campaigns, coverage] = await Promise.all([
    db.dealTransaction.findMany({ select: { id: true, status: true, controlStatus: true } }),
    db.financialProjection.findMany({ select: { transactionId: true, version: true, feeBaseCents: true, probabilityWeightedCents: true } }),
    db.settlementReview.findMany({ select: { transactionId: true, version: true, realizedProfitCents: true } }),
    db.profitPriorityScoreHistory.findMany({ select: { funnelId: true, version: true, contractedFeeCents: true } }),
    db.acquisitionFunnel.findMany({ select: { id: true, stage: true } }),
    db.acquisitionCampaign.findMany({ select: { status: true, outboundEnabled: true } }),
    db.buyerCoverage.findMany({ select: { funnelId: true, role: true, status: true, expiresAt: true } }),
  ]);
  return buildExecutiveKpis({ transactions, projections, settlements, contractedScores, funnels, campaigns, coverage, now });
}
