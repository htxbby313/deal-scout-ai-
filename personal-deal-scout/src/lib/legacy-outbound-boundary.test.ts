import { describe, expect, it } from "vitest";
import { evaluateLegacyOutboundBoundary } from "@/lib/legacy-outbound-boundary";
describe("legacy outbound boundary", () => {
  it("cannot use owner approval to bypass suppression or legal/provider gates", () => { const result = evaluateLegacyOutboundBoundary({ approvalStatus: "APPROVED", transactionActive: true, suppressionClear: false, consentCurrent: true, stateProcedureCurrent: true, disclosurePresent: true, contactWindowVerified: true, providerReady: true, operationAllowed: true, adapterReviewed: true }); expect(result.allowed).toBe(false); expect(result.blockers).toContain("suppression_not_clear"); });
  it("requires a separately reviewed adapter", () => expect(evaluateLegacyOutboundBoundary({ approvalStatus: "APPROVED", transactionActive: true, suppressionClear: true, consentCurrent: true, stateProcedureCurrent: true, disclosurePresent: true, contactWindowVerified: true, providerReady: true, operationAllowed: true, adapterReviewed: false }).allowed).toBe(false));
});
