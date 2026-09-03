export type RehabMode = "COSMETIC" | "MODERATE" | "HEAVY" | "CUSTOM";
export type DealStrategy = "WHOLESALE" | "FLIP" | "BRRRR" | "RENTAL";
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

/** Wholesale MAO is an offer formula, not seller-safe maximum. */
export const DEFAULT_INVESTOR_BPS = 7000;

export function computeWholesaleMao(input: {
  arvCents?: bigint | null;
  repairCents?: bigint | null;
  assignmentFeeCents?: bigint | null;
  investorBps?: number;
}) {
  const investorBps = input.investorBps ?? DEFAULT_INVESTOR_BPS;
  if (
    !Number.isInteger(investorBps) ||
    investorBps <= 0 ||
    investorBps > 10_000
  ) {
    throw new Error("Investor share must be between 1 and 10000 bps.");
  }
  const formula = `MAO = ARV × ${investorBps / 100}% − repairs − assignment fee`;
  if (input.arvCents == null || input.arvCents <= BigInt(0)) {
    return {
      maoCents: null,
      investorBps,
      formula,
      status: "INSUFFICIENT_ARV" as const,
    };
  }
  const repairCents = input.repairCents ?? BigInt(0);
  const assignmentFeeCents = input.assignmentFeeCents ?? BigInt(0);
  if (repairCents < BigInt(0) || assignmentFeeCents < BigInt(0)) {
    throw new Error("Repairs and assignment fee cannot be negative.");
  }
  return {
    maoCents:
      (input.arvCents * BigInt(investorBps)) / BigInt(10_000) -
      repairCents -
      assignmentFeeCents,
    investorBps,
    formula,
    status: "READY" as const,
  };
}
