export type MoneyCents = bigint;

export function parseMoneyToCents(input: string): MoneyCents {
  const normalized = input.trim().replaceAll(",", "").replace(/^\$/, "");
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Money must be a nonnegative decimal with at most two fractional digits.");
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
}

export function formatMoneyFromCents(cents: MoneyCents) {
  const sign = cents < BigInt(0) ? "-" : "";
  const absolute = cents < BigInt(0) ? -cents : cents;
  return `${sign}$${absolute / BigInt(100)}.${(absolute % BigInt(100)).toString().padStart(2, "0")}`;
}

export type ProjectionInput = {
  sellerContractPriceCents: MoneyCents;
  buyerPriceLowCents: MoneyCents;
  buyerPriceBaseCents: MoneyCents;
  buyerPriceHighCents: MoneyCents;
  transactionCostsCents: MoneyCents;
  doubleClosingCostsCents?: MoneyCents;
  titleExpensesCents?: MoneyCents;
  closingExpensesCents?: MoneyCents;
  transactionalFundingCents?: MoneyCents;
  financingCostsCents?: MoneyCents;
  taxesCents?: MoneyCents;
  liensAndPayoffsCents?: MoneyCents;
  concessionsCents: MoneyCents;
  inspectionExpensesCents?: MoneyCents;
  legalExpensesCents?: MoneyCents;
  dataMarketingCostsCents?: MoneyCents;
  insuranceExpensesCents?: MoneyCents;
  otherExpensesCents?: MoneyCents;
  riskReserveCents: MoneyCents;
  contingencyReserveCents?: MoneyCents;
  earnestMoneyDepositedCents?: MoneyCents;
  earnestMoneyAtRiskCents: MoneyCents;
  probabilityLowBps: number;
  probabilityBaseBps: number;
  probabilityHighBps: number;
  targetFeeLowCents?: MoneyCents;
  targetFeeHighCents?: MoneyCents;
};

export function calculateFinancialProjection(input: ProjectionInput) {
  const itemizedCosts = [input.transactionCostsCents, input.doubleClosingCostsCents, input.titleExpensesCents, input.closingExpensesCents, input.transactionalFundingCents, input.financingCostsCents, input.taxesCents, input.liensAndPayoffsCents, input.concessionsCents, input.inspectionExpensesCents, input.legalExpensesCents, input.dataMarketingCostsCents, input.insuranceExpensesCents, input.otherExpensesCents, input.riskReserveCents, input.contingencyReserveCents, input.earnestMoneyAtRiskCents].map((value) => value ?? BigInt(0));
  const money = [input.sellerContractPriceCents, input.buyerPriceLowCents, input.buyerPriceBaseCents, input.buyerPriceHighCents, input.earnestMoneyDepositedCents ?? BigInt(0), ...itemizedCosts];
  if (money.some((value) => value < BigInt(0))) throw new Error("Projection money values must be nonnegative.");
  if (!(input.buyerPriceLowCents <= input.buyerPriceBaseCents && input.buyerPriceBaseCents <= input.buyerPriceHighCents)) throw new Error("Buyer scenarios must be ordered low, base, high.");
  const probabilities = [input.probabilityLowBps, input.probabilityBaseBps, input.probabilityHighBps];
  if (probabilities.some((value) => !Number.isInteger(value) || value < 0) || probabilities.reduce((sum, value) => sum + value, 0) !== 10_000) throw new Error("Scenario probabilities must be nonnegative integer basis points totaling 10,000.");
  const targetFeeLowCents = input.targetFeeLowCents ?? BigInt(1_000_000);
  const targetFeeHighCents = input.targetFeeHighCents ?? BigInt(2_500_000);
  if (targetFeeLowCents < BigInt(0) || targetFeeHighCents < targetFeeLowCents) throw new Error("Target fee range is invalid.");
  const totalCostsCents = itemizedCosts.reduce((sum, value) => sum + value, BigInt(0));
  const fee = (buyerPrice: bigint) => buyerPrice - input.sellerContractPriceCents - totalCostsCents;
  const feeLowCents = fee(input.buyerPriceLowCents);
  const feeBaseCents = fee(input.buyerPriceBaseCents);
  const feeHighCents = fee(input.buyerPriceHighCents);
  const probabilityWeightedCents = (feeLowCents * BigInt(input.probabilityLowBps) + feeBaseCents * BigInt(input.probabilityBaseBps) + feeHighCents * BigInt(input.probabilityHighBps)) / BigInt(10_000);
  const sellerSafeMaximumCents = input.buyerPriceLowCents - totalCostsCents - targetFeeLowCents;
  return { kind: "PROJECTED" as const, totalCostsCents, feeLowCents, feeBaseCents, feeHighCents, probabilityWeightedCents, sellerSafeMaximumCents, targetFeeLowCents, targetFeeHighCents, guaranteed: false as const };
}

export type SettlementReviewInput = {
  grossAssignmentFeeCents: MoneyCents;
  actualExpensesCents: MoneyCents;
  settlementDocumentUrl: string;
  settlementDocumentHash: string;
  reviewedBy: string;
  reviewedAt: string;
};

export function calculateSettlementReviewedProfit(input: SettlementReviewInput) {
  if (input.grossAssignmentFeeCents < BigInt(0) || input.actualExpensesCents < BigInt(0)) throw new Error("Settlement money values must be nonnegative.");
  if (!input.settlementDocumentUrl.startsWith("https://")) throw new Error("A secure settlement document URL is required.");
  if (!/^[a-f\d]{64}$/i.test(input.settlementDocumentHash)) throw new Error("A SHA-256 settlement document hash is required.");
  if (!input.reviewedBy.trim() || !Number.isFinite(Date.parse(input.reviewedAt))) throw new Error("Settlement reviewer and review time are required.");
  return { kind: "REALIZED" as const, realizedProfitCents: input.grossAssignmentFeeCents - input.actualExpensesCents, settlementReviewed: true as const };
}

export function requireAdditiveCorrection(input: { priorId: string; priorVersion: number; correctionReason: string }) {
  if (!input.priorId.trim()) throw new Error("The prior record is required.");
  if (!Number.isInteger(input.priorVersion) || input.priorVersion < 1) throw new Error("The prior version is invalid.");
  if (input.correctionReason.trim().length < 10) throw new Error("A meaningful correction reason is required.");
  return { correctsId: input.priorId, version: input.priorVersion + 1, correctionReason: input.correctionReason.trim(), mutationAllowed: false as const };
}

export function financialAuditDetails(input: { recordId: string; version: number; kind: "PROJECTED" | "REALIZED"; amountCents: MoneyCents; correctsId?: string | null }) {
  if (!input.recordId.trim() || !Number.isInteger(input.version) || input.version < 1) throw new Error("A valid financial record identity is required for audit.");
  return { recordId: input.recordId, version: input.version, kind: input.kind, amountCents: input.amountCents.toString(), correctsId: input.correctsId ?? null, appendOnly: true as const };
}
