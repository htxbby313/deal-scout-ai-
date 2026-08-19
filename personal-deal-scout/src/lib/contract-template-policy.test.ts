import { describe, expect, it } from "vitest";
import { contractTemplateCanBeUsed, evaluateContractTemplateActivation } from "@/lib/contract-template-policy";

describe("contract template activation", () => {
  const now = new Date("2026-08-19T12:00:00Z");
  const complete = { status: "REVIEW_PENDING", jurisdictionState: "TX", requestedJurisdictionState: "TX", artifactHash: "a".repeat(64), artifactLocated: true, userSuppliedBy: "owner", userSuppliedAt: now, counselReviewer: "Texas counsel", counselApprovedAt: now, counselApprovalEvidenceUrl: "https://example.com/review", ownerApprovedBy: "owner", ownerApprovedAt: now, ownerApprovalReason: "Approved supplied version for this jurisdiction.", effectiveAt: new Date("2026-08-01"), expiresAt: new Date("2027-08-01"), now };
  it("keeps placeholders inactive", () => expect(evaluateContractTemplateActivation({ ...complete, status: "INACTIVE_PLACEHOLDER", artifactHash: null, artifactLocated: false }).allowed).toBe(false));
  it("requires the supplied artifact, counsel, owner, jurisdiction, and dates", () => expect(evaluateContractTemplateActivation(complete)).toEqual({ allowed: true, blockers: [] }));
  it("does not use an active template outside its jurisdiction", () => expect(contractTemplateCanBeUsed({ status: "ACTIVE", jurisdictionState: "TX", transactionState: "MS", activatedAt: now, effectiveAt: new Date("2026-01-01"), expiresAt: new Date("2027-01-01"), now })).toBe(false));
});
