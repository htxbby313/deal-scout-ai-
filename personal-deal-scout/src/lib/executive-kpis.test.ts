import { describe, expect, it } from "vitest";
import { buildExecutiveKpis } from "@/lib/executive-kpis";

describe("executive KPIs", () => {
  it("keeps projected, weighted, contracted, and realized values separate and uses latest versions", () => {
    const result = buildExecutiveKpis({
      transactions: [{ id: "t1", status: "UNDER_CONTRACT", controlStatus: "ACTIVE" }, { id: "t2", status: "COMPLETED", controlStatus: "ACTIVE" }],
      projections: [{ transactionId: "t1", version: 1, feeBaseCents: BigInt(1_000_000), probabilityWeightedCents: BigInt(500_000) }, { transactionId: "t1", version: 2, feeBaseCents: BigInt(2_000_000), probabilityWeightedCents: BigInt(1_200_000) }],
      settlements: [{ transactionId: "t2", version: 1, realizedProfitCents: BigInt(900_000) }],
      contractedScores: [{ funnelId: "f1", version: 1, contractedFeeCents: BigInt(1_500_000) }],
      funnels: [{ id: "f1", stage: "CONTRACTED" }, { id: "f2", stage: "DISCOVERED" }],
      campaigns: [{ status: "DRAFT", outboundEnabled: false }],
      coverage: [{ funnelId: "f1", role: "PRIMARY", status: "CONFIRMED", expiresAt: "2026-09-01" }, { funnelId: "f1", role: "BACKUP", status: "CONFIRMED", expiresAt: "2026-09-01" }],
      now: new Date("2026-08-19T12:00:00Z"),
    });
    expect(result.financials).toEqual({ projectedBaseCents: "2000000", probabilityWeightedCents: "1200000", contractedFeeCents: "1500000", realizedProfitCents: "900000", projectedDealCount: 1, contractedDealCount: 1, realizedDealCount: 1 });
    expect(result.funnel).toMatchObject({ total: 2, withPrimaryAndBackup: 1 });
  });

  it("does not count cancelled projections or expired coverage", () => {
    const result = buildExecutiveKpis({ transactions: [{ id: "t1", status: "CANCELLED", controlStatus: "STOPPED" }], projections: [{ transactionId: "t1", version: 1, feeBaseCents: BigInt(1), probabilityWeightedCents: BigInt(1) }], settlements: [], contractedScores: [], funnels: [{ id: "f1", stage: "ARCHIVED" }], campaigns: [], coverage: [{ funnelId: "f1", role: "PRIMARY", status: "CONFIRMED", expiresAt: "2026-01-01" }], now: new Date("2026-08-19") });
    expect(result.financials.projectedBaseCents).toBe("0");
    expect(result.funnel.withPrimaryAndBackup).toBe(0);
    expect(result.transactions.stopped).toBe(1);
  });
});
