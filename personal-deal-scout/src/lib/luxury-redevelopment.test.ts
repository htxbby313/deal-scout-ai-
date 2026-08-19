import { describe, expect, it } from "vitest";
import { evaluateLuxuryRedevelopmentFit } from "@/lib/luxury-redevelopment";

const facts = ["LISTING", "LOCATION", "PRICE", "CONTACT", "PHOTOS"].map((topic) => ({ topic, status: "VERIFIED", sourceUrl: `https://records.example/${topic.toLowerCase()}` }));

describe("luxury redevelopment model", () => {
  it("ranks a verified older luxury property with developer demand", () => {
    const result = evaluateLuxuryRedevelopmentFit({ estimatedValue: 2_500_000, yearBuilt: "1985", lotSize: "0.4 acres", opportunityStatus: "CONFIRMED_AVAILABLE", researchFindings: facts, media: [{ sourceUrl: "https://listing.example/photo" }], matches: [{ score: 85 }] }, 2026);
    expect(result).toMatchObject({ score: 100, eligibleForOwnerReview: true, blockers: [] });
  });

  it("does not promote an unsupported high price into an opportunity", () => {
    const result = evaluateLuxuryRedevelopmentFit({ estimatedValue: 5_000_000, yearBuilt: null, lotSize: null, opportunityStatus: "NEEDS_VERIFICATION", researchFindings: [], media: [], matches: [] }, 2026);
    expect(result.eligibleForOwnerReview).toBe(false);
    expect(result.blockers).toContain("current availability not verified");
    expect(result.score).toBe(0);
  });
});
