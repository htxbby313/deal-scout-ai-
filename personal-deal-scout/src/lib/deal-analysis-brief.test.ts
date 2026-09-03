import { describe, expect, it } from "vitest";
import { buildDealAnalysisBrief } from "./deal-analysis-brief";

describe("deal analysis brief", () => {
  it("assembles why/profit/risks/strategy/next action from stored Deal numbers", () => {
    const brief = buildDealAnalysisBrief({
      verdict: "Work this deal",
      dealScoreExplanation:
        "Score 72: buyer coverage and evidence are ready; projected spread is thin.",
      arvCents: BigInt(200_000_00),
      repairCents: BigInt(20_000_00),
      maoCents: BigInt(105_000_00),
      maoFormula: "MAO = ARV × 70% − repairs − assignment fee",
      spreadCents: BigInt(12_000_00),
      strategy: "WHOLESALE",
      strategyProfitCents: BigInt(10_000_00),
      topBuyerName: "ABC Homes",
      topBuyerInternal: true,
      nextAction: "Complete contract and disposition controls",
      conflictCount: 0,
      repairsAreEstimate: true,
    });
    expect(brief.why).toContain("Score 72");
    expect(brief.profit).toContain("$12,000");
    expect(brief.profit).toContain("$105,000");
    expect(brief.risks).toContain("not shoppable");
    expect(brief.strategy).toContain("wholesale");
    expect(brief.nextAction).toBe("Complete contract and disposition controls");
    expect(brief.assumptions.some((line) => /not MAO/.test(line))).toBe(true);
  });

  it("does not invent a score explanation when none is stored", () => {
    const brief = buildDealAnalysisBrief({
      verdict: "Insufficient verified data — do not offer yet",
      dealScoreExplanation: null,
      arvCents: null,
      repairCents: null,
      maoCents: null,
      maoFormula: "MAO = ARV × 70% − repairs − assignment fee",
      spreadCents: null,
      strategy: null,
      strategyProfitCents: null,
      topBuyerName: null,
      topBuyerInternal: false,
      nextAction: "Resolve conflicting evidence",
      conflictCount: 2,
      repairsAreEstimate: false,
    });
    expect(brief.why).toBe("Insufficient verified data — do not offer yet");
    expect(brief.risks).toContain("2 evidence conflict");
    expect(brief.risks).toContain("ARV not verified");
  });
});
