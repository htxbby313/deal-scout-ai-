import { describe, expect, it } from "vitest";

import { evaluateSellerTransactionFit, qualifyBuyer, sellerIntakeSchema, underwriteAssignment } from "./deal-qualification";

describe("seller intake and ethical transaction fit", () => {
  it("requires contact permission to agree with the selected contact method", () => {
    const base = { propertyId: "p1", sellerName: "Seller", sellerIsOwnerOrAuthorized: true, representationStatus: "UNREPRESENTED", occupancy: "VACANT", saleCondition: "AS_IS", statedGoals: ["AS_IS_SALE"], independentAdviceOffered: true };
    expect(() => sellerIntakeSchema.parse({ ...base, permissionToContact: false, preferredContactMethod: "PHONE" })).toThrow();
    expect(sellerIntakeSchema.parse({ ...base, permissionToContact: false, preferredContactMethod: "NONE" }).permissionToContact).toBe(false);
  });

  it("scores only stated needs and objective market facts", () => {
    const result = evaluateSellerTransactionFit({ sellerIsOwnerOrAuthorized: true, permissionToContact: true, independentAdviceOffered: true, desiredClosingDate: "2026-09-01", evaluationDate: "2026-08-19", listingDaysOnMarket: 100, documentedPriceReductionCount: 2, sellerRequestedAsIsSale: true, sellerRequestedCertainClosing: true, sellerMinimumAcceptableProceeds: 180000, proposedSellerNet: 185000 });
    expect(result).toMatchObject({ eligible: true, score: 100 });
    expect(result.basis).toContain("Objective transaction preferences");
  });

  it("blocks a proposal below the seller's stated minimum", () => {
    const result = evaluateSellerTransactionFit({ sellerIsOwnerOrAuthorized: true, permissionToContact: true, independentAdviceOffered: true, evaluationDate: "2026-08-19", sellerRequestedAsIsSale: false, sellerRequestedCertainClosing: false, sellerMinimumAcceptableProceeds: 200000, proposedSellerNet: 190000 });
    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("proposed seller net is below the seller's stated minimum");
  });
});

describe("buyer qualification", () => {
  const qualified = { identityVerified: true, businessStatusVerified: true, acquisitionCriteriaDocumented: true, verifiedRelevantPurchases: 2, proofOfFundsStatus: "VERIFIED" as const, geographyMatch: true, assetTypeMatch: true, priceRangeMatch: true, acreageMatch: true, assignmentAccepted: true, unresolvedPerformanceIssue: false, communicationConsent: true };

  it("requires both matching criteria and verified closing capacity", () => {
    expect(qualifyBuyer(qualified).qualified).toBe(true);
    const result = qualifyBuyer({ ...qualified, proofOfFundsStatus: "EXPIRED", geographyMatch: false });
    expect(result.qualified).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining(["current proof of funds not verified", "geography does not match"]));
  });
});

describe("conservative assignment underwriting", () => {
  it("subtracts every recorded cost and reports scenarios without guaranteeing profit", () => {
    const result = underwriteAssignment({ sellerContractPrice: 200000, documentedBuyerPriceLow: 222000, documentedBuyerPriceBase: 235000, documentedBuyerPriceHigh: 245000, transactionExpenses: 2500, concessions: 1500, riskReserve: 5000, earnestMoneyAtRisk: 1000 });
    expect(result.projectedAssignmentFee).toEqual({ low: 12000, base: 25000, high: 35000 });
    expect(result.maximumSellerPriceForTarget).toBe(215000);
    expect(result.targetStatus).toBe("WITHIN_TARGET");
    expect(result.disclaimer).toContain("not guaranteed");
  });

  it("rejects unordered price scenarios", () => {
    const result = underwriteAssignment({ sellerContractPrice: 200000, documentedBuyerPriceLow: 240000, documentedBuyerPriceBase: 230000, documentedBuyerPriceHigh: 250000, transactionExpenses: 0, concessions: 0, riskReserve: 0, earnestMoneyAtRisk: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("buyer price scenarios must be ordered low, base, high");
  });
});
