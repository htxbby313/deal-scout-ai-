import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  dealTransaction: { findMany: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ getPrisma: () => db }));
const createControlledTransaction = vi.hoisted(() => vi.fn());
vi.mock("@/lib/transaction-control", () => ({ createControlledTransaction }));

import { calculateFinancialProjection } from "@/lib/financial-truth";
import {
  estimateRehabFromAssumptions,
  parseDealAssumptions,
  saveDealAssumptions,
  serializeDealAssumptions,
} from "@/lib/deal-assumptions";

const baseProjectionInput = {
  sellerContractPriceCents: BigInt(20_000_000),
  buyerPriceLowCents: BigInt(22_200_000),
  buyerPriceBaseCents: BigInt(23_500_000),
  buyerPriceHighCents: BigInt(24_500_000),
  transactionCostsCents: BigInt(250_000),
  concessionsCents: BigInt(150_000),
  riskReserveCents: BigInt(500_000),
  earnestMoneyAtRiskCents: BigInt(100_000),
  probabilityLowBps: 5000,
  probabilityBaseBps: 3500,
  probabilityHighBps: 1500,
} as const;

describe("deal assumptions serialize/parse round trip", () => {
  it("hydrates exactly what was saved for a non-custom rehab mode", () => {
    const record = serializeDealAssumptions({
      strategy: "FLIP",
      rehabMode: "MODERATE",
      squareFeet: 1800,
      ratePerSquareFootCents: BigInt(5000),
      acquisitionCents: BigInt(20_000_000),
      transactionCostsCents: BigInt(250_000),
      financingCostsCents: BigInt(100_000),
      holdingCostsCents: BigInt(75_000),
      updatedBy: "owner",
    });
    const parsed = parseDealAssumptions(record);
    expect(parsed).toMatchObject({
      strategy: "FLIP",
      rehabMode: "MODERATE",
      squareFeet: 1800,
      ratePerSquareFootCents: "5000",
      acquisitionCents: "20000000",
      transactionCostsCents: "250000",
      financingCostsCents: "100000",
      holdingCostsCents: "75000",
    });
  });

  it("hydrates itemized custom rehab categories", () => {
    const record = serializeDealAssumptions({
      strategy: "WHOLESALE",
      rehabMode: "CUSTOM",
      customCents: { roof: BigInt(1_000_000), hvac: BigInt(500_000) },
      updatedBy: "owner",
    });
    const parsed = parseDealAssumptions(record);
    expect(parsed?.customCents?.roof).toBe("1000000");
    expect(parsed?.customCents?.hvac).toBe("500000");
    const rehab = estimateRehabFromAssumptions(parsed!);
    expect(rehab.subtotalCents).toBe(BigInt(1_500_000));
  });

  it("fails closed on unrecognized or corrupt JSON instead of inventing numbers", () => {
    expect(parseDealAssumptions(null)).toBeNull();
    expect(parseDealAssumptions({ version: 999 })).toBeNull();
    expect(
      parseDealAssumptions({
        version: 1,
        strategy: "NOT_A_STRATEGY",
        rehabMode: "MODERATE",
      }),
    ).toBeNull();
    expect(
      parseDealAssumptions({
        version: 1,
        strategy: "FLIP",
        rehabMode: "MODERATE",
        transactionCostsCents: "not-a-bigint",
      }),
    ).toBeNull();
  });

  it("rejects saving without an actor", () => {
    expect(() =>
      serializeDealAssumptions({
        strategy: "FLIP",
        rehabMode: "COSMETIC",
        updatedBy: "  ",
      }),
    ).toThrow();
  });
});

describe("saveDealAssumptions persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.dealTransaction.update.mockResolvedValue({ id: "tx-1", dealAssumptions: {} });
  });

  it("attaches assumptions to the existing canonical transaction without creating a second one", async () => {
    db.dealTransaction.findMany.mockResolvedValue([
      { id: "tx-1", controlStatus: "ACTIVE", status: "RESEARCH", createdAt: new Date() },
    ]);
    await saveDealAssumptions({
      propertyId: "prop-1",
      strategy: "WHOLESALE",
      rehabMode: "COSMETIC",
      updatedBy: "owner",
    });
    expect(createControlledTransaction).not.toHaveBeenCalled();
    expect(db.dealTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tx-1" } }),
    );
  });

  it("creates a controlled transaction via the existing helper when none exists yet, without a trip to /profitability", async () => {
    db.dealTransaction.findMany.mockResolvedValue([]);
    createControlledTransaction.mockResolvedValue({ id: "tx-new" });
    await saveDealAssumptions({
      propertyId: "prop-2",
      strategy: "FLIP",
      rehabMode: "HEAVY",
      updatedBy: "owner",
    });
    expect(createControlledTransaction).toHaveBeenCalledWith({
      propertyId: "prop-2",
      actor: "owner",
    });
    expect(db.dealTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tx-new" } }),
    );
  });
});

describe("rehab assumptions never change seller-safe maximum / assignment spread", () => {
  it("keeps calculateFinancialProjection identical regardless of saved rehab total", () => {
    const before = calculateFinancialProjection(baseProjectionInput);

    // Simulate saving a large rehab estimate on the Deal — financial-truth.ts
    // has no rehab input at all, so this must be a no-op on the projection.
    const assumptions = serializeDealAssumptions({
      strategy: "FLIP",
      rehabMode: "HEAVY",
      squareFeet: 3000,
      updatedBy: "owner",
    });
    const rehab = estimateRehabFromAssumptions(parseDealAssumptions(assumptions)!);
    expect(rehab.totalCents).toBeGreaterThan(BigInt(0));

    const after = calculateFinancialProjection(baseProjectionInput);
    expect(after.sellerSafeMaximumCents).toBe(before.sellerSafeMaximumCents);
    expect(after.feeBaseCents).toBe(before.feeBaseCents);
    expect(after).toEqual(before);
  });
});
