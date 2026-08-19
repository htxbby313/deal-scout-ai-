import { describe, expect, it } from "vitest";
import { calculateProfitPriorityScore, profitPriorityInputSnapshot, validateScoreConfigurationWindow } from "@/lib/profit-priority";

const weights = { projectedProfit: 2500, probability: 2500, sellerFit: 1000, evidence: 1500, buyerCoverage: 1500, velocity: 1000, riskPenalty: 2000 };

describe("profit priority score", () => {
  it("scores from a versionable weight set and preserves all financial truth classes", () => {
    const result = calculateProfitPriorityScore({ projectedBaseCents: BigInt(2_500_000), probabilityWeightedCents: BigInt(1_500_000), contractedFeeCents: null, realizedProfitCents: null, sellerFitScore: 80, evidenceScore: 90, buyerCoverageScore: 75, velocityScore: 60, riskPenaltyScore: 20, targetProfitCents: BigInt(2_500_000) }, weights);
    expect(result.totalScore).toBe(75);
    expect(result.financialTruth).toEqual({ projectedBaseCents: BigInt(2_500_000), probabilityWeightedCents: BigInt(1_500_000), contractedFeeCents: null, realizedProfitCents: null });
    expect(result.reasons).toContain("evidence_ready");
  });

  it("rejects configurations whose positive weights do not total 10,000", () => {
    expect(() => calculateProfitPriorityScore({ projectedBaseCents: BigInt(1), probabilityWeightedCents: BigInt(1), sellerFitScore: 1, evidenceScore: 1, buyerCoverageScore: 1, velocityScore: 1, riskPenaltyScore: 1, targetProfitCents: BigInt(1) }, { ...weights, velocity: 999 })).toThrow(/10,000/);
  });

  it("evaluates configuration effective and expiry windows", () => {
    const now = new Date("2026-08-19T12:00:00Z");
    expect(validateScoreConfigurationWindow({ effectiveAt: new Date("2026-08-01"), expiresAt: new Date("2026-09-01") }, now)).toBe(true);
    expect(validateScoreConfigurationWindow({ effectiveAt: new Date("2026-09-01") }, now)).toBe(false);
  });

  it("serializes BigInt inputs without mixing their financial truth classes", () => {
    expect(profitPriorityInputSnapshot({ projectedBaseCents: BigInt(20), probabilityWeightedCents: BigInt(10), contractedFeeCents: BigInt(8), realizedProfitCents: BigInt(6), sellerFitScore: 1, evidenceScore: 2, buyerCoverageScore: 3, velocityScore: 4, riskPenaltyScore: 5, targetProfitCents: BigInt(25) })).toMatchObject({ projectedBaseCents: "20", probabilityWeightedCents: "10", contractedFeeCents: "8", realizedProfitCents: "6" });
  });
});
