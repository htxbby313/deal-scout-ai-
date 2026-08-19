export type BuyerReliabilityWeights = { financialCapacity: number; marketActivity: number; criteriaSpecificity: number; responseTime: number; closingRate: number; pofFreshness: number; retradePenalty: number; failedClosingPenalty: number; unresolvedIssuePenalty: number };
export type BuyerReliabilityInput = { financialCapacity: number; marketActivity: number; criteriaSpecificity: number; responseTime: number; closingRate: number; pofFreshness: number; retradeRate: number; failedClosingRate: number; unresolvedIssueSeverity: number; pofExpiresAt: Date; demandExpiresAt: Date; communicationAllowed: boolean; now: Date };
const keys = ["financialCapacity","marketActivity","criteriaSpecificity","responseTime","closingRate","pofFreshness","retradePenalty","failedClosingPenalty","unresolvedIssuePenalty"] as const;
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function validateBuyerReliabilityWeights(weights: BuyerReliabilityWeights) {
  const values = keys.map((key) => weights[key]);
  if (values.some((value) => !Number.isInteger(value) || value < 0)) throw new Error("Reliability weights must be nonnegative integers.");
  if (values.reduce((sum, value) => sum + value, 0) !== 10_000) throw new Error("Reliability weights must total 10,000 basis points.");
}

export function calculateBuyerReliability(input: BuyerReliabilityInput, weights: BuyerReliabilityWeights) {
  validateBuyerReliabilityWeights(weights);
  const components = { financialCapacity: clamp(input.financialCapacity), marketActivity: clamp(input.marketActivity), criteriaSpecificity: clamp(input.criteriaSpecificity), responseTime: clamp(input.responseTime), closingRate: clamp(input.closingRate), pofFreshness: clamp(input.pofFreshness), retradePenalty: clamp(input.retradeRate), failedClosingPenalty: clamp(input.failedClosingRate), unresolvedIssuePenalty: clamp(input.unresolvedIssueSeverity) };
  const positive = components.financialCapacity * weights.financialCapacity + components.marketActivity * weights.marketActivity + components.criteriaSpecificity * weights.criteriaSpecificity + components.responseTime * weights.responseTime + components.closingRate * weights.closingRate + components.pofFreshness * weights.pofFreshness;
  const penalties = components.retradePenalty * weights.retradePenalty + components.failedClosingPenalty * weights.failedClosingPenalty + components.unresolvedIssuePenalty * weights.unresolvedIssuePenalty;
  const blockers = [input.pofExpiresAt <= input.now && "proof_of_funds_expired", input.demandExpiresAt <= input.now && "demand_expired", !input.communicationAllowed && "communication_permission_missing"].filter(Boolean) as string[];
  return { totalScore: clamp((positive - penalties) / 10_000), components, blockers, eligible: blockers.length === 0, explanation: [`capacity ${components.financialCapacity}`, `market activity ${components.marketActivity}`, `closing rate ${components.closingRate}`, `retrades penalized ${components.retradePenalty}`, `failed closings penalized ${components.failedClosingPenalty}`, `unresolved issues penalized ${components.unresolvedIssuePenalty}`] };
}

export function validatePropertyBuyerPrice(input: { lowCents: bigint; baseCents: bigint; highCents: bigint; status: string; sourceUrl: string; observedAt: Date; expiresAt: Date; reviewedBy?: string; reviewedAt?: Date; now: Date }) {
  const blockers: string[] = [];
  if (input.lowCents < BigInt(0) || input.lowCents > input.baseCents || input.baseCents > input.highCents) blockers.push("invalid_price_range");
  try { if (new URL(input.sourceUrl).protocol !== "https:") blockers.push("source_not_https"); } catch { blockers.push("source_invalid"); }
  if (input.observedAt > input.now) blockers.push("observation_in_future");
  if (input.expiresAt <= input.now) blockers.push("price_expired");
  if (["DOCUMENTED", "COMMITTED"].includes(input.status) && (!input.reviewedBy || !input.reviewedAt)) blockers.push("review_missing");
  if (!["DOCUMENTED", "COMMITTED"].includes(input.status)) blockers.push("price_not_documented");
  return { verified: blockers.length === 0, blockers };
}
