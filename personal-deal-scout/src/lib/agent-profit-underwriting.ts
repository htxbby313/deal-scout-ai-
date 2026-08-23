export type AgentUnderwritingInput = {
  sellerPriceCents: bigint | null;
  sellerPriceVerified: boolean;
  buyerLowCents: bigint | null;
  buyerBaseCents: bigint | null;
  buyerHighCents: bigint | null;
  buyerPriceStatus: string | null;
  buyerPriceCurrent: boolean;
  knownCostsCents: bigint | null;
  riskReserveCents: bigint | null;
  evidenceCount: number;
  buyerMatchScore: number | null;
};

const cents = (value: bigint | null) => value?.toString() ?? null;

export function underwriteAgentOpportunity(input: AgentUnderwritingInput) {
  const blockers: string[] = [];
  if (!input.sellerPriceVerified || input.sellerPriceCents == null) blockers.push("verified_seller_price_missing");
  if (!input.buyerPriceCurrent || !["DOCUMENTED", "COMMITTED"].includes(input.buyerPriceStatus ?? "") || input.buyerLowCents == null || input.buyerBaseCents == null || input.buyerHighCents == null) blockers.push("current_documented_buyer_price_missing");
  if (input.knownCostsCents == null) blockers.push("itemized_transaction_costs_missing");
  if (input.riskReserveCents == null) blockers.push("risk_reserve_missing");
  if (input.evidenceCount < 1) blockers.push("verified_property_evidence_missing");

  const complete = blockers.length === 0;
  const totalCosts = complete ? input.knownCostsCents! + input.riskReserveCents! : null;
  const fee = (buyer: bigint | null) => complete && buyer != null ? buyer - input.sellerPriceCents! - totalCosts! : null;
  const low = fee(input.buyerLowCents);
  const base = fee(input.buyerBaseCents);
  const high = fee(input.buyerHighCents);
  const score = complete
    ? Math.max(0, Math.min(100, Math.round(((base! >= BigInt(25_000_00) ? 100 : Number(base! * BigInt(100) / BigInt(25_000_00))) * 0.55) + ((input.buyerMatchScore ?? 0) * 0.25) + (Math.min(input.evidenceCount, 20) / 20 * 100 * 0.2))))
    : null;
  const classification = score == null ? "RESEARCH_REQUIRED" : score >= 80 ? "HIGH_PRIORITY" : score >= 60 ? "WORTH_PURSUING" : score >= 40 ? "RESEARCH_FURTHER" : "LOW_VALUE";

  return {
    ready: complete,
    classification,
    score,
    blockers,
    projected: {
      sellerPriceCents: cents(input.sellerPriceCents),
      buyerLowCents: cents(input.buyerLowCents),
      buyerBaseCents: cents(input.buyerBaseCents),
      buyerHighCents: cents(input.buyerHighCents),
      knownCostsCents: cents(input.knownCostsCents),
      riskReserveCents: cents(input.riskReserveCents),
      feeLowCents: cents(low),
      feeBaseCents: cents(base),
      feeHighCents: cents(high),
      guaranteed: false,
    },
  };
}
