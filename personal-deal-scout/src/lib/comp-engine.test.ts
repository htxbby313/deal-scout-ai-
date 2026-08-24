import { describe, expect, it } from "vitest";
import { evaluateComparableSales, type CompEvidence } from "./comp-engine";

const now = new Date("2026-08-23T00:00:00Z");
const comp = (
  id: string,
  price: number,
  overrides: Partial<CompEvidence> = {},
): CompEvidence => ({
  id,
  address: `${id} Main`,
  distanceMiles: 1,
  soldDate: new Date("2026-05-01T00:00:00Z"),
  soldPriceCents: BigInt(price),
  propertyType: "SFR",
  squareFeet: 2000,
  lotSquareFeet: 8000,
  yearBuilt: 2000,
  sourceUrl: "https://county.example/deed",
  observedAt: new Date("2026-08-01T00:00:00Z"),
  verificationStatus: "VERIFIED_PUBLIC_RECORD",
  confidence: 90,
  ...overrides,
});

describe("explainable comparable-sales engine", () => {
  it("returns a sourced range from at least three eligible sales", () => {
    const result = evaluateComparableSales(
      {
        propertyType: "SFR",
        squareFeet: 2100,
        lotSquareFeet: 8500,
        yearBuilt: 2001,
      },
      [comp("a", 30000000), comp("b", 32000000), comp("c", 34000000)],
      now,
    );
    expect(result).toMatchObject({
      valueLowCents: BigInt(30000000),
      valueBaseCents: BigInt(32000000),
      valueHighCents: BigInt(34000000),
    });
    expect(result.selected).toHaveLength(3);
  });

  it("excludes stale, distant, mismatched, and unverified evidence", () => {
    const result = evaluateComparableSales(
      { propertyType: "SFR" },
      [
        comp("bad", 1, {
          distanceMiles: 8,
          propertyType: "LAND",
          verificationStatus: "USER_OBSERVED",
        }),
      ],
      now,
    );
    expect(result.selected).toHaveLength(0);
    expect(result.scored[0].reasons.join(" ")).toContain("Excluded:");
    expect(result.confidence).toBe("INSUFFICIENT_VERIFIED_DATA");
  });
});
