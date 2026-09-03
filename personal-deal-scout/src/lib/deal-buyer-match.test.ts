import { describe, expect, it } from "vitest";

import {
  explainBuyerMatch,
  isDealBoxWorkingSetDeveloper,
  pickComparableVerifiedProject,
  presentDealBoxBuyerMatch,
  selectDealBoxBuyerMatches,
} from "./deal-buyer-match";

const houston = { city: "Houston", state: "TX", zipCode: "77002" };

describe("deal buyer match presentation", () => {
  it("prefers a same-ZIP verified purchase over a same-city project", () => {
    const comparable = pickComparableVerifiedProject(houston, [
      {
        city: "Houston",
        state: "TX",
        zipCode: "77003",
        originalPurchasePrice: 2_000_000,
        sourceRecordDate: "2026-08-01",
        verifiedAt: "2026-08-02",
        sourceUrl: "https://example.gov/city",
      },
      {
        city: "Houston",
        state: "TX",
        zipCode: "77002",
        originalPurchasePrice: 980_000,
        sourceRecordDate: "2026-07-01",
        verifiedAt: "2026-07-02",
        sourceUrl: "https://example.gov/zip",
      },
    ]);
    expect(comparable?.zipCode).toBe("77002");
    expect(comparable?.originalPurchasePrice).toBe(980_000);
  });

  it("explains the match in one sentence with a historic price", () => {
    const comparable = pickComparableVerifiedProject(houston, [
      {
        city: "Houston",
        state: "TX",
        zipCode: "77002",
        originalPurchasePrice: 980_000,
        sourceRecordDate: "2026-08-15",
        verifiedAt: "2026-08-16",
        sourceUrl: "https://example.gov/deed",
      },
    ]);
    expect(
      explainBuyerMatch({
        reasons: ["Has 1 verified purchase(s) in the same ZIP."],
        comparable,
        verifiedProjectCount: 1,
      }),
    ).toMatch(/Bought a verified project in 77002 for \$980,000/);
  });

  it("does not treat RESEARCH_NEEDED with zero verified projects as Deal Box working set", () => {
    expect(isDealBoxWorkingSetDeveloper("RESEARCH_NEEDED", 0)).toBe(false);
    expect(isDealBoxWorkingSetDeveloper("RESEARCH_NEEDED", 1)).toBe(true);
    expect(isDealBoxWorkingSetDeveloper("QUALIFIED", 0)).toBe(true);
    expect(
      selectDealBoxBuyerMatches([
        {
          developer: {
            id: "weak",
            companyName: "Weak Co",
            qualificationStatus: "RESEARCH_NEEDED",
            projects: [],
          },
        },
        {
          developer: {
            id: "ready",
            companyName: "Ready Co",
            qualificationStatus: "QUALIFIED",
            projects: [],
          },
        },
      ]).map((match) => match.developer.id),
    ).toEqual(["ready"]);
  });

  it("keeps contact internal until presentation is allowed", () => {
    const card = presentDealBoxBuyerMatch({
      score: 72,
      reasons: ["Has 1 verified project(s) in the same city."],
      presentationAllowed: false,
      property: houston,
      developer: {
        id: "abc",
        companyName: "ABC Custom Homes",
        qualificationStatus: "PRIORITY",
        phone: "713-555-0100",
        email: "abc@example.com",
        projects: [
          {
            city: "Houston",
            state: "TX",
            zipCode: "77002",
            originalPurchasePrice: 980_000,
            sourceRecordDate: "2026-08-15",
            verifiedAt: "2026-08-16",
            sourceUrl: "https://example.gov/deed",
          },
        ],
      },
    });
    expect(card.companyName).toBe("ABC Custom Homes");
    expect(card.score).toBe(72);
    expect(card.explanation.split(".").filter(Boolean)).toHaveLength(1);
    expect(card.comparableLine).toContain("Houston");
    expect(card.comparableLine).toContain("$980,000");
    expect(card.contactReadiness).toBe(
      "Internal only — do not call or send this deal",
    );
    expect(card.internalOnly).toBe(true);
    expect(card.shoppableLabel).toBe("Not shoppable");
  });
});
