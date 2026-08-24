import { describe, expect, it } from "vitest";
import {
  mediaEligibleForExternalPackage,
  packageReadiness,
} from "./deal-package";

describe("deal package evidence boundary", () => {
  it("excludes unknown, internal, link-only, and unapproved images", () => {
    const base = {
      id: "m",
      url: "https://images.example/a.jpg",
      sourceUrl: "https://listing.example",
      sourceName: "Listing",
      sendApproved: true,
      externalApprovedAt: new Date(),
    };
    expect(
      mediaEligibleForExternalPackage({ ...base, rightsStatus: "UNKNOWN" }),
    ).toBe(false);
    expect(
      mediaEligibleForExternalPackage({
        ...base,
        rightsStatus: "EXTERNAL_APPROVED",
      }),
    ).toBe(true);
  });
  it("blocks a package with evidence conflicts", () => {
    expect(
      packageReadiness({
        propertySourceUrl: "https://county.example",
        verifiedFindingCount: 4,
        conflictCount: 1,
        projectionEvidence: false,
        media: [],
      }).blockers,
    ).toContain("unresolved_evidence_conflicts");
  });
});
