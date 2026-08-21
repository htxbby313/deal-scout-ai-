import { describe, expect, it } from "vitest";
import { buildOperationalKpis } from "@/lib/operational-kpis";
describe("operational KPI definitions", () => {
  it("keeps financial truth classes separate and exposes counts", () => {
    const now = new Date("2026-08-19");
    const report = buildOperationalKpis({
      properties: [
        { createdAt: now, researched: true, researchException: false },
      ],
      funnels: [],
      engagements: [],
      transactions: [],
      outcomes: [],
      buyerEvidence: [],
      costs: [],
      profits: {
        projectedCents: BigInt(100),
        weightedCents: BigInt(50),
        contractedCents: BigInt(20),
        realizedCents: BigInt(10),
        realizedValues: [BigInt(10)],
      },
      evidence: [],
      approvals: [],
      agentTasks: [],
      windowStart: now,
      windowEnd: now,
      refreshedAt: now,
    });
    expect(
      report.metrics.find((m) => m.key === "projected_pipeline")?.value,
    ).toBe("100");
    expect(report.metrics.find((m) => m.key === "realized_profit")?.value).toBe(
      "10",
    );
    expect(
      report.metrics.every((m) => "numerator" in m && "denominator" in m),
    ).toBe(true);
  });
  it("warns on misleadingly small percentage samples", () => {
    const now = new Date();
    const report = buildOperationalKpis({
      properties: [
        { createdAt: now, researched: true, researchException: false },
      ],
      funnels: [],
      engagements: [],
      transactions: [],
      outcomes: [],
      buyerEvidence: [],
      costs: [],
      profits: {
        projectedCents: BigInt(0),
        weightedCents: BigInt(0),
        contractedCents: BigInt(0),
        realizedCents: BigInt(0),
        realizedValues: [],
      },
      evidence: [],
      approvals: [],
      agentTasks: [],
      windowStart: now,
      windowEnd: now,
      refreshedAt: now,
    });
    expect(
      report.metrics.find((m) => m.key === "research_completion_rate")?.warning,
    ).toContain("Small sample");
  });

  it("counts unique reached engagements instead of conversations", () => {
    const now = new Date("2026-08-21");
    const engagement = (conversationCount: number) => ({
      createdAt: now,
      ownerApproved: true,
      attempts: [],
      conversations: Array.from({ length: conversationCount }, () => ({
        occurredAt: now,
      })),
      offers: [],
    });
    const build = (engagements: ReturnType<typeof engagement>[]) =>
      buildOperationalKpis({
        properties: [],
        funnels: [],
        engagements,
        transactions: [],
        outcomes: [],
        buyerEvidence: [],
        costs: [{ type: "SOURCE", amountCents: BigInt(900) }],
        profits: {
          projectedCents: BigInt(0),
          weightedCents: BigInt(0),
          contractedCents: BigInt(0),
          realizedCents: BigInt(0),
          realizedValues: [],
        },
        evidence: [],
        approvals: [],
        agentTasks: [],
        windowStart: now,
        windowEnd: now,
        refreshedAt: now,
      }).metrics.find((item) => item.key === "cost_per_seller_reached");
    expect(build([engagement(3)])).toMatchObject({
      value: "900",
      denominator: 1,
      sampleSize: 1,
    });
    expect(build([engagement(1), engagement(1), engagement(1)])).toMatchObject({
      value: "300",
      denominator: 3,
      sampleSize: 3,
    });
    expect(build([engagement(0)])).toMatchObject({
      value: null,
      denominator: 0,
      sampleSize: 0,
    });
  });
});
