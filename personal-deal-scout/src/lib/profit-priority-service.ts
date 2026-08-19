import "server-only";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  calculateProfitPriorityScore,
  profitPriorityInputSnapshot,
  type ProfitPriorityInputs,
  validateScoreConfigurationWindow,
} from "@/lib/profit-priority";

export async function createProfitPriorityConfiguration(input: {
  weights: {
    projectedProfit: number;
    probability: number;
    sellerFit: number;
    evidence: number;
    buyerCoverage: number;
    velocity: number;
    riskPenalty: number;
  };
  reason: string;
  actor: string;
  effectiveAt: Date;
  expiresAt?: Date;
}) {
  calculateProfitPriorityScore(
    {
      projectedBaseCents: BigInt(0),
      probabilityWeightedCents: BigInt(0),
      sellerFitScore: 0,
      evidenceScore: 0,
      buyerCoverageScore: 0,
      velocityScore: 0,
      riskPenaltyScore: 0,
      targetProfitCents: BigInt(1),
    },
    input.weights,
  );
  if (
    input.reason.trim().length < 10 ||
    (input.expiresAt && input.expiresAt <= input.effectiveAt)
  )
    throw new Error(
      "Score configuration requires a clear reason and a valid effective window.",
    );
  return getPrisma().$transaction(
    async (tx) => {
      const latest = await tx.profitPriorityScoreConfiguration.findFirst({
        orderBy: { version: "desc" },
      });
      return tx.profitPriorityScoreConfiguration.create({
        data: {
          version: (latest?.version ?? 0) + 1,
          status: "DRAFT",
          projectedProfitWeight: input.weights.projectedProfit,
          probabilityWeight: input.weights.probability,
          sellerFitWeight: input.weights.sellerFit,
          evidenceWeight: input.weights.evidence,
          buyerCoverageWeight: input.weights.buyerCoverage,
          velocityWeight: input.weights.velocity,
          riskPenaltyWeight: input.weights.riskPenalty,
          reason: input.reason.trim(),
          createdBy: input.actor,
          effectiveAt: input.effectiveAt,
          expiresAt: input.expiresAt,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function activateProfitPriorityConfiguration(input: {
  configurationId: string;
  actor: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return getPrisma().$transaction(
    async (tx) => {
      const config =
        await tx.profitPriorityScoreConfiguration.findUniqueOrThrow({
          where: { id: input.configurationId },
        });
      if (
        config.status !== "DRAFT" ||
        !config.effectiveAt ||
        !validateScoreConfigurationWindow(
          { effectiveAt: config.effectiveAt, expiresAt: config.expiresAt },
          now,
        )
      )
        throw new Error(
          "Only a current draft score configuration can be activated.",
        );
      await tx.profitPriorityScoreConfiguration.updateMany({
        where: { status: "ACTIVE" },
        data: { status: "RETIRED" },
      });
      const active = await tx.profitPriorityScoreConfiguration.update({
        where: { id: config.id },
        data: { status: "ACTIVE" },
      });
      await tx.auditLog.create({
        data: {
          type: "profit_priority.configuration.activated",
          summary: `Activated profit-priority configuration v${config.version}.`,
          details: { configurationId: config.id, actor: input.actor },
        },
      });
      return active;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function recordProfitPriorityScore(input: {
  funnelId: string;
  configurationId: string;
  inputs: ProfitPriorityInputs;
  calculatedBy: string;
  expiresAt: Date;
}) {
  if (!input.calculatedBy.trim())
    throw new Error("A score calculator identity is required.");
  const now = new Date();
  if (input.expiresAt <= now)
    throw new Error("Score history must have a future expiry.");
  const db = getPrisma();
  return db.$transaction(
    async (tx) => {
      const [funnel, configuration, latest] = await Promise.all([
        tx.acquisitionFunnel.findUnique({
          where: { id: input.funnelId },
          select: { id: true },
        }),
        tx.profitPriorityScoreConfiguration.findUnique({
          where: { id: input.configurationId },
        }),
        tx.profitPriorityScoreHistory.findFirst({
          where: { funnelId: input.funnelId },
          orderBy: { version: "desc" },
          select: { version: true },
        }),
      ]);
      if (!funnel) throw new Error("Acquisition funnel not found.");
      if (
        !configuration ||
        configuration.status !== "ACTIVE" ||
        !configuration.effectiveAt ||
        !validateScoreConfigurationWindow(
          {
            effectiveAt: configuration.effectiveAt,
            expiresAt: configuration.expiresAt,
          },
          now,
        )
      )
        throw new Error(
          "An active, effective score configuration is required.",
        );
      const score = calculateProfitPriorityScore(input.inputs, {
        projectedProfit: configuration.projectedProfitWeight,
        probability: configuration.probabilityWeight,
        sellerFit: configuration.sellerFitWeight,
        evidence: configuration.evidenceWeight,
        buyerCoverage: configuration.buyerCoverageWeight,
        velocity: configuration.velocityWeight,
        riskPenalty: configuration.riskPenaltyWeight,
      });
      return tx.profitPriorityScoreHistory.create({
        data: {
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
          probabilityWeightedCents:
            score.financialTruth.probabilityWeightedCents,
          contractedFeeCents: score.financialTruth.contractedFeeCents,
          realizedProfitCents: score.financialTruth.realizedProfitCents,
          reasons: score.reasons,
          blockers: score.blockers,
          inputSnapshot: profitPriorityInputSnapshot(
            input.inputs,
          ) as Prisma.InputJsonValue,
          calculatedBy: input.calculatedBy.trim(),
          expiresAt: input.expiresAt,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
