import { describe, expect, it } from "vitest";
import { evaluatePropertyPresentation } from "./property-presentation-policy";

describe("property presentation control", () => {
  it("blocks property presentation without a contractual interest", () => {
    expect(evaluatePropertyPresentation(null)).toEqual({
      allowed: false,
      blockers: ["contractual_interest_missing"],
    });
  });

  it("allows presentation only after the complete current control record exists", () => {
    const now = new Date("2026-08-23T12:00:00Z");
    expect(
      evaluatePropertyPresentation(
        {
          status: "UNDER_CONTRACT",
          controlStatus: "ACTIVE",
          counselApprovedAt: now,
          complianceVerifiedAt: now,
          documents: [
            {
              type: "PURCHASE_AGREEMENT",
              status: "EXECUTED",
              executedAt: now,
              contentHash: "abc",
              sourceUrl: "https://records.example/agreement",
            },
          ],
          approvals: [
            {
              type: "ASSIGNMENT_MARKETING",
              status: "APPROVED",
              decidedAt: now,
              expiresAt: new Date("2026-09-01T00:00:00Z"),
            },
          ],
          acquisitionFunnel: {
            stage: "CONTRACTED",
            gates: [
              {
                type: "CONTRACT",
                version: 1,
                status: "SATISFIED",
                expiresAt: new Date("2026-09-01T00:00:00Z"),
              },
              {
                type: "DISPOSITION",
                version: 1,
                status: "SATISFIED",
                expiresAt: new Date("2026-09-01T00:00:00Z"),
              },
            ],
          },
        },
        now,
      ).allowed,
    ).toBe(true);
  });

  it("does not accept funnel labels as a substitute for transaction contract status", () => {
    const result = evaluatePropertyPresentation({
      status: "DRAFT",
      controlStatus: "ACTIVE",
      counselApprovedAt: new Date(),
      complianceVerifiedAt: new Date(),
      documents: [],
      approvals: [],
      acquisitionFunnel: { stage: "CONTRACTED", gates: [] },
    });
    expect(result.blockers).toContain("transaction_status_not_contracted");
  });
});
