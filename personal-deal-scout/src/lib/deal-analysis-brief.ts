export type DealAnalysisBrief = {
  why: string;
  profit: string;
  risks: string;
  strategy: string;
  nextAction: string;
  assumptions: string[];
};

const money = (cents?: bigint | null) =>
  cents == null
    ? "unknown"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(Number(cents) / 100);

export function buildDealAnalysisBrief(input: {
  verdict: string;
  dealScoreExplanation?: string | null;
  arvCents?: bigint | null;
  repairCents?: bigint | null;
  maoCents?: bigint | null;
  maoFormula: string;
  spreadCents?: bigint | null;
  strategy?: string | null;
  strategyProfitCents?: bigint | null;
  topBuyerName?: string | null;
  topBuyerInternal: boolean;
  nextAction: string;
  conflictCount: number;
  repairsAreEstimate: boolean;
}): DealAnalysisBrief {
  const assumptions = [
    input.maoFormula,
    "Seller-safe maximum is a cap, not MAO.",
    input.repairsAreEstimate
      ? "Repairs are an estimate, not a contractor bid."
      : "Repairs are not set; MAO treats them as $0 until saved.",
    "Projected spread is not earned until settlement.",
  ];
  const why = input.dealScoreExplanation
    ? input.dealScoreExplanation
    : input.verdict;
  const profit =
    input.spreadCents != null
      ? `Projected assignment spread ${money(input.spreadCents)}. MAO ${money(input.maoCents)} on ARV ${money(input.arvCents)}.`
      : `MAO ${money(input.maoCents)} on ARV ${money(input.arvCents)}. Spread not yet projected.`;
  const riskParts = [];
  if (input.conflictCount > 0)
    riskParts.push(`${input.conflictCount} evidence conflict(s)`);
  if (input.repairCents == null) riskParts.push("repairs not set");
  if (input.arvCents == null) riskParts.push("ARV not verified");
  if (input.topBuyerInternal)
    riskParts.push("buyer matches are not shoppable yet");
  const risks = riskParts.length
    ? `${riskParts.join("; ")}.`
    : "No listed blockers in the current Deal Box numbers.";
  const strategyName = (input.strategy ?? "WHOLESALE").toLowerCase();
  const strategy =
    input.strategyProfitCents != null
      ? `${strategyName} estimate ${money(input.strategyProfitCents)} — not guaranteed.`
      : `${strategyName} assumptions are not complete enough for a profit estimate.`;
  return {
    why,
    profit,
    risks,
    strategy,
    nextAction: input.nextAction,
    assumptions,
  };
}
