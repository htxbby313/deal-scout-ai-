import { describe, expect, it } from "vitest";
import { evaluateEngagementGate, evaluateProviderReadiness } from "@/lib/engagement-safety-policy";

describe("seller engagement safety", () => {
  const base = { transactionControl: "ACTIVE" as const, transactionState: "TX", engagementState: "TX", channel: "SMS" as const, ownerApproved: true, suppressed: false, consentStatus: "GRANTED" as const, statePolicy: { enabled: true, counselApprovedAt: new Date(), reviewedAt: new Date() }, providerReady: true };
  it("blocks suppression even when every other gate passes", () => expect(evaluateEngagementGate({ ...base, suppressed: true }).allowed).toBe(false));
  it("blocks external engagement without owner approval", () => expect(evaluateEngagementGate({ ...base, ownerApproved: false }).reasons).toContain("Owner approval is required."));
  it("blocks missing consent and unreviewed state policy", () => {
    const result = evaluateEngagementGate({ ...base, consentStatus: "UNKNOWN", statePolicy: null });
    expect(result.allowed).toBe(false);
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });
  it("requires every provider readiness control", () => expect(evaluateProviderReadiness({ credentialsConfigured: true, webhookVerified: true, suppressionIntegrated: false, auditIntegrated: true, ownerEnabled: true, environment: "SANDBOX", environmentConfigured: true, authenticationVerified: true, allowedOperations: ["DRAFT"], idempotencyVerified: true, retryBoundariesVerified: true, sandboxVerified: true })).toEqual({ ready: false, missing: ["suppressionIntegrated"] }));
});
