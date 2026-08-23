import { describe, expect, it } from "vitest";
import { underwriteAgentOpportunity } from "@/lib/agent-profit-underwriting";

describe("agent profit underwriting", () => {
  it("refuses to fabricate profit when required financial evidence is missing", () => {
    const result = underwriteAgentOpportunity({ sellerPriceCents: BigInt(30_000_000), sellerPriceVerified: true, buyerLowCents: null, buyerBaseCents: null, buyerHighCents: null, buyerPriceStatus: null, buyerPriceCurrent: false, knownCostsCents: null, riskReserveCents: null, evidenceCount: 4, buyerMatchScore: 80 });
    expect(result.ready).toBe(false);
    expect(result.projected.feeBaseCents).toBeNull();
    expect(result.blockers).toContain("current_documented_buyer_price_missing");
  });

  it("calculates exact non-guaranteed low, base, and high profit from complete evidence", () => {
    const result = underwriteAgentOpportunity({ sellerPriceCents: BigInt(30_000_000), sellerPriceVerified: true, buyerLowCents: BigInt(31_500_000), buyerBaseCents: BigInt(32_500_000), buyerHighCents: BigInt(34_000_000), buyerPriceStatus: "DOCUMENTED", buyerPriceCurrent: true, knownCostsCents: BigInt(500_000), riskReserveCents: BigInt(250_000), evidenceCount: 12, buyerMatchScore: 90 });
    expect(result.ready).toBe(true);
    expect(result.projected).toMatchObject({ feeLowCents: "750000", feeBaseCents: "1750000", feeHighCents: "3250000", guaranteed: false });
  });
});
