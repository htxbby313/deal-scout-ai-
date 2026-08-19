import { describe, expect, it } from "vitest";

import { evaluateTransactionGate } from "@/lib/transaction-policy";

describe("transaction control policy", () => {
  it("blocks every progression while the owner hold is active", () => {
    const result = evaluateTransactionGate({
      controlStatus: "ON_HOLD",
      nextStatus: "DUE_DILIGENCE",
      approvals: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("Transaction control is ON_HOLD.");
  });

  it("requires compliance, counsel, and explicit approval before a contract", () => {
    const result = evaluateTransactionGate({
      controlStatus: "ACTIVE",
      nextStatus: "UNDER_CONTRACT",
      approvals: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([
      "Counsel approval is not recorded.",
      "Compliance verification is not recorded.",
      "CONTRACT owner approval is required.",
    ]));
  });

  it("accepts a current explicit approval when legal gates are recorded", () => {
    const result = evaluateTransactionGate({
      controlStatus: "ACTIVE",
      nextStatus: "UNDER_CONTRACT",
      counselApprovedAt: new Date("2026-08-01"),
      complianceVerifiedAt: new Date("2026-08-02"),
      approvals: [{ type: "CONTRACT", status: "APPROVED", expiresAt: null }],
    });
    expect(result).toEqual({ allowed: true, reasons: [] });
  });

  it("never treats a generic status change as proof of closing", () => {
    const result = evaluateTransactionGate({
      controlStatus: "ACTIVE",
      nextStatus: "COMPLETED",
      counselApprovedAt: new Date(),
      complianceVerifiedAt: new Date(),
      approvals: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("Completion must be recorded through the verified closing workflow.");
  });
});
