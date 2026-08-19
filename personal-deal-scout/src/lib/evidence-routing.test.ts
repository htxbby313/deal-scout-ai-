import { describe, expect, it } from "vitest";

import { routeBuyerQualificationEvidence, routeEvidenceCompleteness, routeSellerFitEvidence, type EvidenceItem } from "./evidence-routing";

const verified = (field: string, value: unknown, origin: EvidenceItem["origin"] = "USER_ATTESTATION", observedAt = "2026-08-18", sourceUrl?: string): EvidenceItem => ({ field, value, origin, observedAt, sourceUrl, verificationStatus: "VERIFIED" });

describe("deterministic evidence completeness routing", () => {
  it("routes absent seller-entered facts to manual verification", () => {
    const result = routeSellerFitEvidence([], "2026-08-19");
    expect(result.status).toBe("NEEDS_MANUAL_VERIFICATION");
    expect(result.missing).toEqual(["seller authority", "contact permission", "seller-stated goals", "seller minimum proceeds", "independent advice offered"]);
  });

  it("accepts explicit false and zero values rather than inventing truthiness", () => {
    const evidence = [
      verified("sellerAuthority", false), verified("permissionToContact", false), verified("sellerGoals", ["MAXIMIZE_PRICE"]),
      verified("minimumAcceptableProceeds", 0), verified("independentAdviceOffered", false),
    ];
    expect(routeSellerFitEvidence(evidence, "2026-08-19").status).toBe("COMPLETE");
  });

  it("routes stale and future-dated evidence to manual verification", () => {
    const result = routeEvidenceCompleteness({
      evaluatedAt: "2026-08-19T00:00:00Z",
      requirements: [{ field: "proof", label: "proof", acceptedOrigins: ["AUTHORIZED_DOCUMENT"], maxAgeDays: 30 }],
      evidence: [verified("proof", "document", "AUTHORIZED_DOCUMENT", "2026-09-01T00:00:00Z")],
    });
    expect(result).toMatchObject({ status: "NEEDS_MANUAL_VERIFICATION", stale: ["proof"] });
  });

  it("does not treat an unverified or conflicted value as evidence", () => {
    const result = routeEvidenceCompleteness({
      evaluatedAt: "2026-08-19",
      requirements: [{ field: "identity", label: "identity", acceptedOrigins: ["PUBLIC_SOURCE"] }],
      evidence: [{ ...verified("identity", "Company", "PUBLIC_SOURCE"), verificationStatus: "CONFLICT" }],
    });
    expect(result).toMatchObject({ status: "NEEDS_MANUAL_VERIFICATION", conflicted: ["identity"], verifiedCount: 0 });
  });

  it("requires authorized, fresh proof of funds instead of a public-page claim", () => {
    const evidence = [
      verified("buyerIdentity", "Buyer LLC", "PUBLIC_SOURCE", "2026-08-01", "https://state.example/entity"),
      verified("businessStatus", "ACTIVE", "PUBLIC_SOURCE", "2026-08-01", "https://state.example/entity"),
      verified("acquisitionCriteria", "Land in TX"),
      verified("relevantPurchaseHistory", 2, "PUBLIC_SOURCE", "2026-07-01", "https://county.example/deeds"),
      verified("proofOfFunds", "$1m", "PUBLIC_SOURCE", "2026-08-18", "https://buyer.example/about"),
      verified("assignmentAccepted", true), verified("communicationConsent", true),
    ];
    const result = routeBuyerQualificationEvidence(evidence, "2026-08-19");
    expect(result.status).toBe("NEEDS_MANUAL_VERIFICATION");
    expect(result.missing).toContain("proof of funds");
  });

  it("completes buyer evidence only when every required item is verified and fresh", () => {
    const evidence = [
      verified("buyerIdentity", "Buyer LLC", "PUBLIC_SOURCE", "2026-08-01", "https://state.example/entity"),
      verified("businessStatus", "ACTIVE", "PUBLIC_SOURCE", "2026-08-01", "https://state.example/entity"),
      verified("acquisitionCriteria", "Land in TX"),
      verified("relevantPurchaseHistory", 2, "PUBLIC_SOURCE", "2026-07-01", "https://county.example/deeds"),
      verified("proofOfFunds", "$1m", "AUTHORIZED_DOCUMENT", "2026-08-18", "https://secure.example/proof"),
      verified("assignmentAccepted", true), verified("communicationConsent", true),
    ];
    expect(routeBuyerQualificationEvidence(evidence, "2026-08-19")).toMatchObject({ status: "COMPLETE", manualNeeded: 0, verifiedCount: 7 });
  });
});
