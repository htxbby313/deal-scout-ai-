import { describe, expect, it } from "vitest";
import { scoreMotivatedSeller } from "@/lib/motivated-seller-score";

describe("motivated seller scoring", () => {
  it("prioritizes documented owner-controlled distress", () => {
    const result = scoreMotivatedSeller({ ownerName: "Taylor Owner", leadSource: "FSBO", notes: "Pre-foreclosure; property needs major repairs", researchFindings: [{ status: "VERIFIED", topic: "LIENS", label: "Notice of default" }] });
    expect(result).toMatchObject({ eligible: true, motivationScore: 80, feasibilityScore: 60 });
    expect(result.signals).toContain("For sale by owner");
  });

  it("keeps underwater motivation separate from closing feasibility", () => {
    const result = scoreMotivatedSeller({ ownerName: "Taylor Owner", notes: "Estimated underwater mortgage and negative equity", researchFindings: [{ status: "VERIFIED", topic: "LIENS", label: "Mortgage estimate" }] });
    expect(result.motivationScore).toBe(25);
    expect(result.feasibilityScore).toBe(30);
    expect(result.blockers).toContain("Payoff or short-sale path needs verification");
  });

  it("excludes HUD and lender-owned inventory", () => {
    expect(scoreMotivatedSeller({ ownerName: "HUD", opportunityStatus: "GOVERNMENT_SALE" }).eligible).toBe(false);
    expect(scoreMotivatedSeller({ ownerName: "Example Bank", notes: "REO" }).eligible).toBe(false);
  });
});
