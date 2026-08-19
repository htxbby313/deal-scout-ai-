import "server-only";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { calculateProfitPriorityScore, profitPriorityInputSnapshot, type ProfitPriorityInputs, validateScoreConfigurationWindow } from "@/lib/profit-priority";

export async function recordProfitPriorityScore(input: {
  funnelId: string;
  configurationId: string;
  inputs: ProfitPriorityInputs;
  calculatedBy: string;
  expiresAt: Date;
}) {
  if (!input.calculatedBy.trim()) throw new Error("A score calculator identity is required.");
  const now = new Date();
  if (input.expiresAt <= now) throw new Error("Score history must have a future expiry.");
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    const [funnel, configuration, latest] = await Promise.all([
      tx.acquisitionFunnel.findUnique({ where: { id: input.funnelId }, select: { id: true } }),
      tx.profitPriorityScoreConfiguration.findUnique({ where: { id: input.configurationId } }),
      tx.profitPriorityScoreHistory.findFirst({ where: { funnelId: input.funnelId }, orderBy: { version: "desc" }, select: { version: true } }),
    ]);
    if (!funnel) throw new Error("Acquisition funnel not found.");
    if (!configuration || configuration.status !== "ACTIVE" || !configuration.effectiveAt || !validateScoreConfigurationWindow({ effectiveAt: configuration.effectiveAt, expiresAt: configuration.expiresAt }, now)) throw new Error("An active, effective score configuration is required.");
    const score = calculateProfitPriorityScore(input.inputs, {
      projectedProfit: configuration.projectedProfitWeight,
      probability: configuration.probabilityWeight,
      sellerFit: configuration.sellerFitWeight,
      evidence: configuration.evidenceWeight,
      buyerCoverage: configuration.buyerCoverageWeight,
      velocity: configuration.velocityWeight,
      riskPenalty: configuration.riskPenaltyWeight,
    });
    return tx.profitPriorityScoreHistory.create({ data: {
      funnelId: input.funnelId,
      configurationId: input.configurationId,
      version: (latest?.version ?? 0) + 1,
      totalScore: score.totalScore,
      projectedProfitScore: score.projectedProfitScore,
      probabilityScore: score.probabilityScore,
      sellerFitScore: score.sellerFitScore,
      evidenceScore: score.evidenceScore,
      buyerCoverageScore: score.buyerCoverageScore,
      velocityScore: score.velocityScore,
      riskPenaltyScore: score.riskPenaltyScore,
      projectedBaseCents: score.financialTruth.projectedBaseCents,
      probabilityWeightedCents: score.financialTruth.probabilityWeightedCents,
      contractedFeeCents: score.financialTruth.contractedFeeCents,
      realizedProfitCents: score.financialTruth.realizedProfitCents,
      reasons: score.reasons,
      blockers: score.blockers,
      inputSnapshot: profitPriorityInputSnapshot(input.inputs) as Prisma.InputJsonValue,
      calculatedBy: input.calculatedBy.trim(),
      expiresAt: input.expiresAt,
    } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
