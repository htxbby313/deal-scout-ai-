import { describe, expect, it } from "vitest";
import { evaluateRetentionPolicyActivation, evaluateRetentionReview, redactSensitiveAuditDetails } from "@/lib/data-governance-policy";

describe("data retention and sensitive audit policy", () => {
  it("keeps unapproved retention policy inactive", () => expect(evaluateRetentionPolicyActivation({ retentionDays: 365, jurisdictionState: "TX" }).allowed).toBe(false));
  it("never automatically deletes records", () => expect(evaluateRetentionReview({ dueAt: new Date(0), policyActive: true, now: new Date() })).toMatchObject({ status: "ELIGIBLE_FOR_MANUAL_DELETION", automaticDeletionAllowed: false }));
  it("legal hold always retains", () => expect(evaluateRetentionReview({ dueAt: new Date(0), policyActive: true, legalHoldReason: "Pending dispute" }).status).toBe("LEGAL_HOLD"));
  it("redacts nested contact and credential fields", () => expect(redactSensitiveAuditDetails({ phone: "555", nested: { apiToken: "secret", evidenceId: "safe" } })).toEqual({ phone: "[REDACTED]", nested: { apiToken: "[REDACTED]", evidenceId: "safe" } }));
});
