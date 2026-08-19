import { describe, expect, it } from "vitest";
import { calculateFinancialProjection, calculateSettlementReviewedProfit, financialAuditDetails, formatMoneyFromCents, parseMoneyToCents, requireAdditiveCorrection } from "./financial-truth";

describe("financial truth", () => {
  it("subtracts every itemized cost from projected spread", () => {
    const result = calculateFinancialProjection({ sellerContractPriceCents: BigInt(100_000), buyerPriceLowCents: BigInt(300_000), buyerPriceBaseCents: BigInt(300_000), buyerPriceHighCents: BigInt(300_000), transactionCostsCents: BigInt(1_000), titleExpensesCents: BigInt(2_000), financingCostsCents: BigInt(3_000), concessionsCents: BigInt(4_000), riskReserveCents: BigInt(5_000), contingencyReserveCents: BigInt(6_000), earnestMoneyAtRiskCents: BigInt(7_000), probabilityLowBps: 0, probabilityBaseBps: 10_000, probabilityHighBps: 0 });
    expect(result.totalCostsCents).toBe(BigInt(28_000));
    expect(result.feeBaseCents).toBe(BigInt(172_000));
  });
  it("parses money exactly without floating point", () => {
    expect(parseMoneyToCents("$1,234.56")).toBe(BigInt(123456));
    expect(formatMoneyFromCents(BigInt(-105))).toBe("-$1.05");
    expect(() => parseMoneyToCents("1.005")).toThrow();
  });

  it("calculates conservative scenarios and probability-weighted value in cents", () => {
    const result = calculateFinancialProjection({ sellerContractPriceCents: BigInt(20_000_000), buyerPriceLowCents: BigInt(22_200_000), buyerPriceBaseCents: BigInt(23_500_000), buyerPriceHighCents: BigInt(24_500_000), transactionCostsCents: BigInt(250_000), concessionsCents: BigInt(150_000), riskReserveCents: BigInt(500_000), earnestMoneyAtRiskCents: BigInt(100_000), probabilityLowBps: 5000, probabilityBaseBps: 3500, probabilityHighBps: 1500 });
    expect(result).toMatchObject({ kind: "PROJECTED", feeLowCents: BigInt(1_200_000), feeBaseCents: BigInt(2_500_000), feeHighCents: BigInt(3_500_000), probabilityWeightedCents: BigInt(2_000_000), sellerSafeMaximumCents: BigInt(20_200_000), guaranteed: false });
  });

  it("requires probabilities to total exactly 100 percent", () => {
    expect(() => calculateFinancialProjection({ sellerContractPriceCents: BigInt(1), buyerPriceLowCents: BigInt(2), buyerPriceBaseCents: BigInt(3), buyerPriceHighCents: BigInt(4), transactionCostsCents: BigInt(0), concessionsCents: BigInt(0), riskReserveCents: BigInt(0), earnestMoneyAtRiskCents: BigInt(0), probabilityLowBps: 3300, probabilityBaseBps: 3300, probabilityHighBps: 3300 })).toThrow();
  });

  it("never reports realized profit without reviewed settlement evidence", () => {
    expect(() => calculateSettlementReviewedProfit({ grossAssignmentFeeCents: BigInt(2_000_000), actualExpensesCents: BigInt(100_000), settlementDocumentUrl: "", settlementDocumentHash: "not-a-hash", reviewedBy: "", reviewedAt: "" })).toThrow();
    expect(calculateSettlementReviewedProfit({ grossAssignmentFeeCents: BigInt(2_000_000), actualExpensesCents: BigInt(100_000), settlementDocumentUrl: "https://documents.example/settlement", settlementDocumentHash: "a".repeat(64), reviewedBy: "owner", reviewedAt: "2026-08-19T20:00:00Z" })).toEqual({ kind: "REALIZED", realizedProfitCents: BigInt(1_900_000), settlementReviewed: true });
  });

  it("represents corrections as new versions linked to prior records", () => {
    expect(requireAdditiveCorrection({ priorId: "record-1", priorVersion: 2, correctionReason: "Correct settlement expense total." })).toEqual({ correctsId: "record-1", version: 3, correctionReason: "Correct settlement expense total.", mutationAllowed: false });
    expect(financialAuditDetails({ recordId: "record-2", version: 3, kind: "REALIZED", amountCents: BigInt(1_900_000), correctsId: "record-1" })).toEqual({ recordId: "record-2", version: 3, kind: "REALIZED", amountCents: "1900000", correctsId: "record-1", appendOnly: true });
  });
});
