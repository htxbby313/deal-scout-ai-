import { describe, expect, it } from "vitest";
import { calculateProfitabilityKpis } from "@/lib/profitability-kpis";

describe("profitability KPI separation", () => {
  it("never blends projected pipeline with settlement-backed realized profit", () => {
    const result = calculateProfitabilityKpis([
      { stage: "UNDERWRITING_READY", projectedNetCents: BigInt(2_000_000), probabilityWeightedCents: BigInt(800_000), discoveredAt: new Date("2026-01-01") },
      { stage: "CLOSED", projectedNetCents: BigInt(3_000_000), probabilityWeightedCents: BigInt(2_000_000), realizedNetCents: BigInt(2_500_000), discoveredAt: new Date("2026-01-01"), closedAt: new Date("2026-01-31") },
    ]);
    expect(result).toMatchObject({ projectedPipelineCents: "2000000", probabilityWeightedPipelineCents: "800000", realizedProfitCents: "2500000", realizedEvidenceCount: 1, averageDiscoveryToCloseDays: 30 });
  });
});
