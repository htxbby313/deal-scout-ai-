import { describe, expect, it } from "vitest";
import { applySettlementCorrections, validateSettlementFields } from "@/lib/settlement-policy";

describe("settlement validation", () => {
  it("rejects future or negative settlement facts", () => {
    const result = validateSettlementFields({ closingDate: new Date("2027-01-01"), assignmentFee: -1 }, new Date("2026-08-19"));
    expect(result.valid).toBe(false);
    expect(result.reasons.length).toBe(2);
  });
  it("applies corrections additively without changing the original", () => {
    const original = { closingDate: new Date("2026-08-01"), assignmentFee: 10_000 };
    const effective = applySettlementCorrections(original, [{ assignmentFee: 12_500 }]);
    expect(original.assignmentFee).toBe(10_000);
    expect(effective.assignmentFee).toBe(12_500);
  });
});
