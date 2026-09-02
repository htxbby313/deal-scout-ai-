import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  property: { findUnique: vi.fn() },
  dealTransaction: { findMany: vi.fn(), create: vi.fn() },
  acquisitionFunnel: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  acquisitionStageHistory: { create: vi.fn() },
  transactionAuditEvent: { findFirst: vi.fn(), create: vi.fn() },
}));
vi.mock("@prisma/client", () => ({
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
}));
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({
    $transaction: (operation: (client: typeof tx) => unknown) =>
      operation(tx),
  }),
}));

import { ACTIVE_DEAL_TRANSACTION_EXISTS_MESSAGE } from "@/lib/deal";
import { createControlledTransaction } from "@/lib/transaction-control";

describe("createControlledTransaction one-active guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.property.findUnique.mockResolvedValue({ state: "MS" });
    tx.dealTransaction.create.mockResolvedValue({ id: "tx-new" });
    tx.acquisitionFunnel.findFirst.mockResolvedValue(null);
    tx.acquisitionFunnel.create.mockResolvedValue({ id: "funnel-new" });
    tx.transactionAuditEvent.findFirst.mockResolvedValue(null);
  });

  it("refuses a second live DealTransaction on the same property", async () => {
    tx.dealTransaction.findMany.mockResolvedValue([
      { controlStatus: "ACTIVE", status: "RESEARCH" },
    ]);
    await expect(
      createControlledTransaction({ propertyId: "prop-1", actor: "owner" }),
    ).rejects.toThrow(ACTIVE_DEAL_TRANSACTION_EXISTS_MESSAGE);
    expect(tx.dealTransaction.create).not.toHaveBeenCalled();
  });

  it("creates after existing rows are STOPPED or terminal", async () => {
    tx.dealTransaction.findMany.mockResolvedValue([
      { controlStatus: "STOPPED", status: "CANCELLED" },
    ]);
    await expect(
      createControlledTransaction({ propertyId: "prop-1", actor: "owner" }),
    ).resolves.toEqual({ id: "tx-new" });
    expect(tx.dealTransaction.create).toHaveBeenCalledOnce();
  });
});
