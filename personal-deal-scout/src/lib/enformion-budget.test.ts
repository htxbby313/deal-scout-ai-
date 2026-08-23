import { describe, expect, it } from "vitest";
import { __enformionBudgetTestables, enformionMonthlyLimit } from "@/lib/enformion-budget";

describe("Enformion monthly budget", () => {
  it("defaults conservatively and supports a confirmed upgraded allowance", () => {
    expect(enformionMonthlyLimit(undefined)).toBe(100);
    expect(enformionMonthlyLimit("3000")).toBe(3000);
  });

  it("rejects invalid or excessive limits", () => {
    expect(enformionMonthlyLimit("0")).toBe(100);
    expect(enformionMonthlyLimit("3001")).toBe(100);
    expect(enformionMonthlyLimit("not-a-number")).toBe(100);
  });

  it("uses exact UTC calendar-month boundaries", () => {
    expect(__enformionBudgetTestables.currentUtcMonth(new Date("2026-12-31T23:59:59Z"))).toEqual({ start: new Date("2026-12-01T00:00:00Z"), end: new Date("2027-01-01T00:00:00Z"), key: "2026-12" });
  });
});
