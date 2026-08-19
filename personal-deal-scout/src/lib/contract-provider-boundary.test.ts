import { describe, expect, it } from "vitest";
import { evaluateContractProviderBoundary } from "@/lib/contract-provider-boundary";

describe("contract/provider boundary", () => {
  it("never converts readiness into execution authority", () => {
    const now = new Date("2026-08-19");
    const result = evaluateContractProviderBoundary({ transactionControl: "ACTIVE", transactionState: "TX", ownerActionApproved: true, template: { status: "ACTIVE", jurisdictionState: "TX", activatedAt: now, effectiveAt: new Date("2026-01-01"), expiresAt: new Date("2027-01-01") }, provider: { credentialsConfigured: true, webhookVerified: true, suppressionIntegrated: true, auditIntegrated: true, ownerEnabled: true, environment: "SANDBOX", environmentConfigured: true, authenticationVerified: true, allowedOperations: ["DRAFT"], idempotencyVerified: true, retryBoundariesVerified: true, sandboxVerified: true }, now });
    expect(result.prerequisitesSatisfied).toBe(true);
    expect(result.executionAuthorized).toBe(false);
    expect(result.blockers).toContain("execution_requires_separate_human_action");
  });
});
