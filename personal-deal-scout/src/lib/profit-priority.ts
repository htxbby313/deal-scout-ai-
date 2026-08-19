export type ProfitPriorityWeights = {
  projectedProfit: number;
  probability: number;
  sellerFit: number;
  evidence: number;
  buyerCoverage: number;
  velocity: number;
  riskPenalty: number;
};

export type ProfitPriorityInputs = {
  projectedBaseCents: bigint;
  probabilityWeightedCents: bigint;
  contractedFeeCents?: bigint | null;
  realizedProfitCents?: bigint | null;
  sellerFitScore: number;
  evidenceScore: number;
  buyerCoverageScore: number;
  velocityScore: number;
  riskPenaltyScore: number;
  targetProfitCents: bigint;
};

function bounded(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function profitScore(value: bigint, target: bigint) {
  if (target <= BigInt(0)) throw new Error("Target profit must be positive.");
  if (value <= BigInt(0)) return 0;
  return bounded(Number((value * BigInt(10_000)) / target) / 100);
}

export function calculateProfitPriorityScore(input: ProfitPriorityInputs, weights: ProfitPriorityWeights) {
  const entries = Object.entries(weights);
  if (entries.some(([, weight]) => !Number.isInteger(weight) || weight < 0)) throw new Error("Priority weights must be nonnegative integers.");
  const positiveWeight = weights.projectedProfit + weights.probability + weights.sellerFit + weights.evidence + weights.buyerCoverage + weights.velocity;
  if (positiveWeight !== 10_000 || weights.riskPenalty > 10_000) throw new Error("Positive priority weights must total 10,000 basis points and risk penalty cannot exceed 10,000.");

  const components = {
    projectedProfitScore: profitScore(input.projectedBaseCents, input.targetProfitCents),
    probabilityScore: profitScore(input.probabilityWeightedCents, input.targetProfitCents),
    sellerFitScore: bounded(input.sellerFitScore),
    evidenceScore: bounded(input.evidenceScore),
    buyerCoverageScore: bounded(input.buyerCoverageScore),
    velocityScore: bounded(input.velocityScore),
    riskPenaltyScore: bounded(input.riskPenaltyScore),
  };
  const positive = components.projectedProfitScore * weights.projectedProfit
    + components.probabilityScore * weights.probability
    + components.sellerFitScore * weights.sellerFit
    + components.evidenceScore * weights.evidence
    + components.buyerCoverageScore * weights.buyerCoverage
    + components.velocityScore * weights.velocity;
  const penalty = components.riskPenaltyScore * weights.riskPenalty;
  const totalScore = bounded((positive - penalty) / 10_000);
  const reasons = [components.projectedProfitScore >= 70 && "projected_profit", components.probabilityScore >= 70 && "probability_weighted_profit", components.evidenceScore >= 70 && "evidence_ready", components.buyerCoverageScore >= 70 && "buyer_coverage"].filter(Boolean) as string[];
  const blockers = [components.evidenceScore < 50 && "evidence_incomplete", components.buyerCoverageScore < 50 && "buyer_coverage_incomplete", components.riskPenaltyScore >= 70 && "risk_high"].filter(Boolean) as string[];
  return {
    totalScore,
    ...components,
    reasons,
    blockers,
    financialTruth: {
      projectedBaseCents: input.projectedBaseCents,
      probabilityWeightedCents: input.probabilityWeightedCents,
      contractedFeeCents: input.contractedFeeCents ?? null,
      realizedProfitCents: input.realizedProfitCents ?? null,
    },
  };
}

export function validateScoreConfigurationWindow(input: { effectiveAt: Date; expiresAt?: Date | null }, now: Date) {
  return input.effectiveAt <= now && (!input.expiresAt || input.expiresAt > now);
}

export function profitPriorityInputSnapshot(input: ProfitPriorityInputs) {
  return {
    projectedBaseCents: input.projectedBaseCents.toString(),
    probabilityWeightedCents: input.probabilityWeightedCents.toString(),
    contractedFeeCents: input.contractedFeeCents?.toString() ?? null,
    realizedProfitCents: input.realizedProfitCents?.toString() ?? null,
    sellerFitScore: input.sellerFitScore,
    evidenceScore: input.evidenceScore,
    buyerCoverageScore: input.buyerCoverageScore,
    velocityScore: input.velocityScore,
    riskPenaltyScore: input.riskPenaltyScore,
    targetProfitCents: input.targetProfitCents.toString(),
  };
}

export function evaluateStoredProfitPriority(input: { score: number; blockers: readonly string[]; expiresAt: Date; stage: string; controlStatus?: string | null; now: Date }) {
  const blockers = [...input.blockers];
  if (input.controlStatus === "STOPPED") blockers.push("transaction_stopped");
  if (["DISQUALIFIED", "ARCHIVED"].includes(input.stage)) blockers.push("inactive_funnel_stage");
  if (input.expiresAt <= input.now) blockers.push("priority_score_expired");
  return { eligible: blockers.length === 0, visibleScore: blockers.length === 0 ? input.score : null, blockers };
}
