import { z } from "zod";

const optionalMoney = z.number().finite().nonnegative().nullable().optional();

export const sellerIntakeSchema = z.object({
  propertyId: z.string().trim().min(1),
  sellerName: z.string().trim().min(1),
  sellerIsOwnerOrAuthorized: z.boolean(),
  representationStatus: z.enum(["UNREPRESENTED", "REPRESENTED", "UNKNOWN"]),
  permissionToContact: z.boolean(),
  preferredContactMethod: z.enum(["PHONE", "EMAIL", "TEXT", "MAIL", "NONE"]),
  desiredClosingDate: z.iso.date().nullable().optional(),
  minimumAcceptableProceeds: optionalMoney,
  mortgageEstimate: optionalMoney,
  knownLienEstimate: optionalMoney,
  occupancy: z.enum(["OWNER_OCCUPIED", "TENANT_OCCUPIED", "VACANT", "UNKNOWN"]),
  saleCondition: z.enum(["AS_IS", "REPAIRS_PLANNED", "UNKNOWN"]),
  statedGoals: z.array(z.enum([
    "CERTAIN_CLOSING",
    "FLEXIBLE_CLOSING",
    "QUICK_CLOSING",
    "AS_IS_SALE",
    "MAXIMIZE_PRICE",
    "OTHER",
  ])).max(6),
  independentAdviceOffered: z.boolean(),
}).superRefine((input, context) => {
  if (input.permissionToContact && input.preferredContactMethod === "NONE") {
    context.addIssue({ code: "custom", path: ["preferredContactMethod"], message: "Select a permitted contact method." });
  }
  if (!input.permissionToContact && input.preferredContactMethod !== "NONE") {
    context.addIssue({ code: "custom", path: ["preferredContactMethod"], message: "Contact method must be NONE without permission." });
  }
});

export type SellerIntake = z.infer<typeof sellerIntakeSchema>;

export type SellerFitInput = {
  sellerIsOwnerOrAuthorized: boolean;
  permissionToContact: boolean;
  independentAdviceOffered: boolean;
  desiredClosingDate?: string | null;
  evaluationDate: string;
  listingDaysOnMarket?: number | null;
  documentedPriceReductionCount?: number | null;
  sellerRequestedAsIsSale: boolean;
  sellerRequestedCertainClosing: boolean;
  sellerMinimumAcceptableProceeds?: number | null;
  proposedSellerNet?: number | null;
};

export function evaluateSellerTransactionFit(input: SellerFitInput) {
  const blockers: string[] = [];
  const signals: string[] = [];
  let score = 0;

  if (!input.sellerIsOwnerOrAuthorized) blockers.push("seller authority not verified");
  if (!input.permissionToContact) blockers.push("contact permission not recorded");
  if (!input.independentAdviceOffered) blockers.push("independent advice not offered");
  if (input.proposedSellerNet == null || input.sellerMinimumAcceptableProceeds == null) {
    blockers.push("seller proceeds fit not verified");
  } else if (input.proposedSellerNet < input.sellerMinimumAcceptableProceeds) {
    blockers.push("proposed seller net is below the seller's stated minimum");
  }

  if ((input.listingDaysOnMarket ?? 0) >= 90) { score += 20; signals.push("listing active at least 90 days"); }
  if ((input.documentedPriceReductionCount ?? 0) >= 2) { score += 15; signals.push("multiple documented price reductions"); }
  if (input.sellerRequestedAsIsSale) { score += 20; signals.push("seller requested an as-is sale"); }
  if (input.sellerRequestedCertainClosing) { score += 20; signals.push("seller requested closing certainty"); }

  if (input.desiredClosingDate) {
    const desired = Date.parse(`${input.desiredClosingDate}T00:00:00Z`);
    const evaluated = Date.parse(`${input.evaluationDate}T00:00:00Z`);
    if (Number.isFinite(desired) && Number.isFinite(evaluated)) {
      const days = Math.ceil((desired - evaluated) / 86_400_000);
      if (days >= 0 && days <= 45) { score += 25; signals.push("seller stated a closing date within 45 days"); }
    }
  }

  return {
    eligible: blockers.length === 0,
    score: Math.min(score, 100),
    signals,
    blockers,
    basis: "Objective transaction preferences and documented property-market facts only.",
  };
}

export type BuyerQualificationInput = {
  identityVerified: boolean;
  businessStatusVerified: boolean;
  acquisitionCriteriaDocumented: boolean;
  verifiedRelevantPurchases: number;
  proofOfFundsStatus: "VERIFIED" | "REQUESTED" | "MISSING" | "EXPIRED";
  geographyMatch: boolean;
  assetTypeMatch: boolean;
  priceRangeMatch: boolean;
  acreageMatch?: boolean | null;
  assignmentAccepted: boolean;
  unresolvedPerformanceIssue: boolean;
  communicationConsent: boolean;
};

export function qualifyBuyer(input: BuyerQualificationInput) {
  const blockers: string[] = [];
  if (!input.identityVerified) blockers.push("buyer identity not verified");
  if (!input.businessStatusVerified) blockers.push("business status not verified");
  if (!input.acquisitionCriteriaDocumented) blockers.push("acquisition criteria not documented");
  if (input.verifiedRelevantPurchases < 1) blockers.push("no verified relevant purchase history");
  if (input.proofOfFundsStatus !== "VERIFIED") blockers.push("current proof of funds not verified");
  if (!input.geographyMatch) blockers.push("geography does not match");
  if (!input.assetTypeMatch) blockers.push("asset type does not match");
  if (!input.priceRangeMatch) blockers.push("price range does not match");
  if (input.acreageMatch === false) blockers.push("acreage does not match");
  if (!input.assignmentAccepted) blockers.push("assignment terms not accepted");
  if (input.unresolvedPerformanceIssue) blockers.push("unresolved performance issue");
  if (!input.communicationConsent) blockers.push("buyer communication consent not recorded");

  return { qualified: blockers.length === 0, blockers };
}

export type AssignmentUnderwritingInput = {
  sellerContractPrice: number;
  documentedBuyerPriceLow: number;
  documentedBuyerPriceBase: number;
  documentedBuyerPriceHigh: number;
  transactionExpenses: number;
  concessions: number;
  riskReserve: number;
  earnestMoneyAtRisk: number;
  targetFeeLow?: number;
  targetFeeHigh?: number;
};

export function underwriteAssignment(input: AssignmentUnderwritingInput) {
  const targetLow = input.targetFeeLow ?? 10_000;
  const targetHigh = input.targetFeeHigh ?? 25_000;
  const costs = input.transactionExpenses + input.concessions + input.riskReserve + input.earnestMoneyAtRisk;
  const feeFor = (buyerPrice: number) => buyerPrice - input.sellerContractPrice - costs;
  const lowFee = feeFor(input.documentedBuyerPriceLow);
  const baseFee = feeFor(input.documentedBuyerPriceBase);
  const highFee = feeFor(input.documentedBuyerPriceHigh);
  const errors: string[] = [];

  if ([input.sellerContractPrice, input.documentedBuyerPriceLow, input.documentedBuyerPriceBase, input.documentedBuyerPriceHigh, input.transactionExpenses, input.concessions, input.riskReserve, input.earnestMoneyAtRisk].some((value) => !Number.isFinite(value) || value < 0)) {
    errors.push("all underwriting amounts must be finite and nonnegative");
  }
  if (!(input.documentedBuyerPriceLow <= input.documentedBuyerPriceBase && input.documentedBuyerPriceBase <= input.documentedBuyerPriceHigh)) {
    errors.push("buyer price scenarios must be ordered low, base, high");
  }
  if (!(targetLow >= 0 && targetHigh >= targetLow)) errors.push("target fee range is invalid");

  const maximumSellerPriceForTarget = input.documentedBuyerPriceBase - costs - targetLow;
  const targetStatus = baseFee < targetLow ? "BELOW_TARGET" : baseFee > targetHigh ? "ABOVE_TARGET" : "WITHIN_TARGET";

  return {
    valid: errors.length === 0,
    errors,
    costs,
    projectedAssignmentFee: { low: lowFee, base: baseFee, high: highFee },
    maximumSellerPriceForTarget,
    targetRange: { low: targetLow, high: targetHigh },
    targetStatus,
    disclaimer: "Projection only. It is not guaranteed revenue and requires verified buyer demand, legal review, title clearance, and closing.",
  };
}
