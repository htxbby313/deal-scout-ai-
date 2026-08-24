import { describe, expect, it } from "vitest";
import {
  latestAcquisitionGate,
  latestAcquisitionGates,
} from "@/lib/acquisition-gate-versioning";

describe("acquisition gate versioning", () => {
  it("uses a newer failed gate instead of stale satisfied evidence", () => {
    const gates = [
      { type: "SELLER_ENGAGED", version: 1, status: "SATISFIED" },
      { type: "SELLER_ENGAGED", version: 2, status: "FAILED" },
    ];

    expect(latestAcquisitionGate(gates, "SELLER_ENGAGED")?.status).toBe(
      "FAILED",
    );
  });

  it("uses a newer satisfied gate after an earlier failure is resolved", () => {
    const gates = [
      { type: "BUYER_COVERAGE", version: 2, status: "SATISFIED" },
      { type: "BUYER_COVERAGE", version: 1, status: "FAILED" },
      { type: "SELLER_ENGAGED", version: 1, status: "SATISFIED" },
    ];

    expect(latestAcquisitionGates(gates)).toEqual([
      { type: "BUYER_COVERAGE", version: 2, status: "SATISFIED" },
      { type: "SELLER_ENGAGED", version: 1, status: "SATISFIED" },
    ]);
  });
});
