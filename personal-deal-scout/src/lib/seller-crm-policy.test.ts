import { describe, expect, it } from "vitest";
import { evaluateContactAttempt, evaluateOfferStatus, validateSellerFacts } from "@/lib/seller-crm-policy";
describe("seller CRM policy", () => {
  it("never lets approval override suppression", () => expect(evaluateContactAttempt({ suppressed: true, consentGranted: true, policyActive: true, insidePermittedWindow: true, ownerApproved: true, providerReady: true, transactionControlStatus: "ACTIVE" }).canDeliver).toBe(false));
  it("requires sourced authority and advice when policy requires it", () => expect(validateSellerFacts({ sellerStatedAt: new Date("2026-08-19T11:00:00Z"), conversationOccurredAt: new Date("2026-08-19T10:00:00Z"), authorityStatus: "VERIFIED", independentAdviceRequired: true, now: new Date("2026-08-19T12:00:00Z") }).blockers).toEqual(["authority_source_missing","independent_advice_not_offered"]));
  it("keeps non-draft offers behind owner and artifact gates", () => expect(evaluateOfferStatus({ requestedStatus: "OWNER_APPROVED", transactionActive: true, now: new Date() }).allowed).toBe(false));
});
