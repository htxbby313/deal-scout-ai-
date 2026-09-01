export type RehabMode = "COSMETIC" | "MODERATE" | "HEAVY" | "CUSTOM";
export type DealStrategy = "WHOLESALE" | "WHOLETAIL" | "FLIP" | "CREATIVE" | "BRRRR" | "RENTAL" | "PASS";
export const REHAB_CATEGORIES = [
  "roof",
  "hvac",
  "electrical",
  "plumbing",
  "foundation",
  "kitchen",
  "bathrooms",
  "flooring",
  "paint",
  "windows",
  "landscaping",
] as const;

export function calculateWholesaleDecision(input: {
  afterRepairValueCents: bigint | null;
  repairsCents: bigint;
  desiredAssignmentFeeCents: bigint;
  buyerAllowanceCents: bigint;
  sellerAskingPriceCents: bigint;
  ruleBps?: number;
}) {
  if (!input.afterRepairValueCents) return { maximumAllowableOfferCents: null, expectedSpreadCents: null, decision: "NEEDS_BETTER_NUMBERS" as const };
  const ruleBps = input.ruleBps ?? 7000;
  const maximumAllowableOfferCents =
    (input.afterRepairValueCents * BigInt(ruleBps)) / BigInt(10_000) -
    input.repairsCents - input.desiredAssignmentFeeCents - input.buyerAllowanceCents;
  const expectedSpreadCents = maximumAllowableOfferCents - input.sellerAskingPriceCents;
  const decision = expectedSpreadCents >= input.desiredAssignmentFeeCents
    ? "STRONG_DEAL" as const
    : expectedSpreadCents >= BigInt(0)
      ? "WORTH_CONTACTING" as const
      : expectedSpreadCents >= -input.desiredAssignmentFeeCents
        ? "NEEDS_BETTER_NUMBERS" as const
        : "LIKELY_PASS" as const;
  return { maximumAllowableOfferCents, expectedSpreadCents, decision };
}

export function estimateRehab(input: {
  mode: RehabMode;
  squareFeet?: number | null;
  ratePerSquareFootCents?: bigint;
  customCents?: Partial<Record<(typeof REHAB_CATEGORIES)[number], bigint>>;
  contingencyBps?: number;
}) {
  const contingencyBps = input.contingencyBps ?? 1000;
  if (
    !Number.isInteger(contingencyBps) ||
    contingencyBps < 0 ||
    contingencyBps > 5000
  )
    throw new Error("Contingency must be between 0 and 50%. ");
  const squareFeet = input.squareFeet ?? 0;
  const defaultRates: Record<Exclude<RehabMode, "CUSTOM">, bigint> = {
    COSMETIC: BigInt(2500),
    MODERATE: BigInt(5000),
    HEAVY: BigInt(9000),
  };
  const categoryCents =
    input.mode === "CUSTOM"
      ? Object.fromEntries(
          REHAB_CATEGORIES.map((category) => [
            category,
            input.customCents?.[category] ?? BigInt(0),
          ]),
        )
      : {
          wholeProperty:
            BigInt(Math.max(0, Math.round(squareFeet))) *
            (input.ratePerSquareFootCents ?? defaultRates[input.mode]),
        };
  const subtotalCents = Object.values(categoryCents).reduce(
    (sum, amount) => sum + amount,
    BigInt(0),
  );
  const contingencyCents =
    (subtotalCents * BigInt(contingencyBps)) / BigInt(10_000);
  return {
    mode: input.mode,
    categoryCents,
    subtotalCents,
    contingencyCents,
    totalCents: subtotalCents + contingencyCents,
    disclaimer: "Estimate, not contractor bid.",
  };
}

type AnalysisInput = {
  strategy: DealStrategy;
  acquisitionCents: bigint;
  verifiedExitLowCents?: bigint | null;
  verifiedExitBaseCents?: bigint | null;
  verifiedExitHighCents?: bigint | null;
  rehabCents?: bigint;
  transactionCostsCents?: bigint;
  financingCostsCents?: bigint;
  holdingCostsCents?: bigint;
  riskReserveCents?: bigint;
  assignmentFeeCents?: bigint;
  monthlyRentCents?: bigint;
  monthlyExpensesCents?: bigint;
};
export function analyzeDealStrategy(input: AnalysisInput) {
  const costs =
    (input.rehabCents ?? BigInt(0)) +
    (input.transactionCostsCents ?? BigInt(0)) +
    (input.financingCostsCents ?? BigInt(0)) +
    (input.holdingCostsCents ?? BigInt(0)) +
    (input.riskReserveCents ?? BigInt(0));
  if (
    !input.verifiedExitLowCents ||
    !input.verifiedExitBaseCents ||
    !input.verifiedExitHighCents
  )
    return {
      strategy: input.strategy,
      status: "INSUFFICIENT_VERIFIED_DATA" as const,
      lowCents: null,
      baseCents: null,
      highCents: null,
      explanation: [
        "A sourced low/base/high exit value or buyer price is required.",
      ],
      guaranteed: false,
    };
  let extra = BigInt(0);
  const explanation: string[] = [
    "Uses verified low/base/high exit evidence.",
    "Subtracts acquisition, transaction, financing, holding, rehabilitation, and risk-reserve costs.",
  ];
  if (input.strategy === "WHOLESALE") {
    extra = input.assignmentFeeCents ?? BigInt(0);
    explanation.push(
      "Assignment fee is a target, not earned revenue until settlement.",
    );
  }
  if (input.strategy === "RENTAL" || input.strategy === "BRRRR") {
    if (!input.monthlyRentCents)
      return {
        strategy: input.strategy,
        status: "INSUFFICIENT_VERIFIED_DATA" as const,
        lowCents: null,
        baseCents: null,
        highCents: null,
        explanation: ["Verified monthly rent evidence is required."],
        guaranteed: false,
      };
    const annualNet =
      (input.monthlyRentCents - (input.monthlyExpensesCents ?? BigInt(0))) *
      BigInt(12);
    extra -= annualNet;
    explanation.push(
      "First-year verified net rent is included separately from resale spread.",
    );
  }
  const result = [
    input.verifiedExitLowCents,
    input.verifiedExitBaseCents,
    input.verifiedExitHighCents,
  ].map((exit) => exit - input.acquisitionCents - costs - extra);
  return {
    strategy: input.strategy,
    status:
      result[0] > BigInt(0)
        ? ("VERIFIED_PROFIT_OPPORTUNITY" as const)
        : result[2] <= BigInt(0)
          ? ("BELOW_TARGET" as const)
          : ("RISK_SENSITIVE" as const),
    lowCents: result[0],
    baseCents: result[1],
    highCents: result[2],
    explanation,
    guaranteed: false,
  };
}
