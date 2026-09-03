import { describe, expect, it } from "vitest";
import { listingFactLines, listingFacts } from "./listing-facts";

describe("opportunity listing facts", () => {
  it("uses cached year, lot, and source date without inventing MLS or DOM", () => {
    const facts = listingFacts({
      yearBuilt: "1984",
      lotSize: "0.21 ac",
      sourceRecordDate: "2026-08-15",
      researchFindings: [
        {
          topic: "DIMENSIONS",
          status: "VERIFIED",
          value: "60 ft frontage",
        },
        {
          topic: "LISTING",
          status: "NOT_FOUND",
          value: "should be ignored",
        },
      ],
    });
    expect(facts.yearBuilt).toBe("1984");
    expect(facts.sourceDate).toMatch(/2026/);
    expect(facts.dimensions).toBe("60 ft frontage");
    expect(facts.listing).toBeNull();
    expect(listingFactLines(facts).map((line) => line.label)).toEqual([
      "Year",
      "Lot",
      "Dimensions",
      "Source date",
    ]);
  });

  it("does not treat a missing source date as days on market", () => {
    const facts = listingFacts({
      yearBuilt: " ",
      sourceRecordDate: null,
      researchFindings: [],
    });
    expect(facts.sourceDate).toBeNull();
    expect(listingFactLines(facts)).toEqual([]);
  });
});
