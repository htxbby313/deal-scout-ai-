import { describe, expect, it } from "vitest";
import { analyzeDealStrategy, calculateWholesaleDecision, estimateRehab } from "./deal-analysis";

describe("deal strategy and rehab analysis", () => {
  it("labels automated rehabilitation figures as estimates", () => {
    const result = estimateRehab({ mode: "MODERATE", squareFeet: 2000 });
    expect(result.totalCents).toBe(BigInt(11_000_000));
    expect(result.disclaimer).toBe("Estimate, not contractor bid.");
  });
  it("supports itemized custom rehabilitation assumptions", () => {
    const result = estimateRehab({
      mode: "CUSTOM",
      customCents: { roof: BigInt(1_000_000), hvac: BigInt(500_000) },
      contingencyBps: 1000,
    });
    expect(result.totalCents).toBe(BigInt(1_650_000));
  });
  it("fails closed without a verified exit range", () => {
    expect(
      analyzeDealStrategy({
        strategy: "FLIP",
        acquisitionCents: BigInt(20_000_000),
      }).status,
    ).toBe("INSUFFICIENT_VERIFIED_DATA");
  });
  it("keeps projected wholesale spread non-guaranteed", () => {
    const result = analyzeDealStrategy({
      strategy: "WHOLESALE",
      acquisitionCents: BigInt(20_000_000),
      verifiedExitLowCents: BigInt(30_000_000),
      verifiedExitBaseCents: BigInt(32_000_000),
      verifiedExitHighCents: BigInt(34_000_000),
      transactionCostsCents: BigInt(1_000_000),
      riskReserveCents: BigInt(1_000_000),
    });
    expect(result).toMatchObject({
      status: "VERIFIED_PROFIT_OPPORTUNITY",
      baseCents: BigInt(10_000_000),
      guaranteed: false,
    });
  });
  it("calculates MAO and a plain-language wholesale decision", () => {
    expect(calculateWholesaleDecision({
      afterRepairValueCents: BigInt(30_000_000),
      repairsCents: BigInt(4_000_000),
      desiredAssignmentFeeCents: BigInt(1_500_000),
      buyerAllowanceCents: BigInt(500_000),
      sellerAskingPriceCents: BigInt(14_000_000),
    })).toEqual({
      maximumAllowableOfferCents: BigInt(15_000_000),
      expectedSpreadCents: BigInt(1_000_000),
      decision: "WORTH_CONTACTING",
    });
  });
});
