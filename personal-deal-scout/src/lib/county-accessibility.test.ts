import { describe, expect, it } from "vitest";
import { classifyCountyAccessibility, requireReviewedCountyAdapter, safeCountyAccessibilityUrl } from "@/lib/county-accessibility";

describe("county source accessibility", () => {
  it("permits only credential-free public HTTPS endpoints", () => {
    expect(safeCountyAccessibilityUrl("https://records.example.gov/search")?.hostname).toBe("records.example.gov");
    expect(safeCountyAccessibilityUrl("http://records.example.gov")).toBeNull();
    expect(safeCountyAccessibilityUrl("https://192.168.1.1/search")).toBeNull();
    expect(safeCountyAccessibilityUrl("https://user:secret@records.example.gov")).toBeNull();
  });

  it("never probes sources without verified automation permission", () => {
    expect(classifyCountyAccessibility({ automationStatus: "UNKNOWN", authenticationRequired: false, subscriptionRequired: false, httpStatus: 200 }).status).toBe("NEEDS_REVIEW");
    expect(classifyCountyAccessibility({ automationStatus: "PROHIBITED", authenticationRequired: false, subscriptionRequired: false, httpStatus: 200 }).status).toBe("RESTRICTED");
  });

  it("classifies permitted endpoint responses without inventing record coverage", () => {
    const base = { automationStatus: "PERMITTED" as const, authenticationRequired: false, subscriptionRequired: false };
    expect(classifyCountyAccessibility({ ...base, httpStatus: 204 }).status).toBe("AUTOMATED");
    expect(classifyCountyAccessibility({ ...base, httpStatus: 403 }).status).toBe("MANUAL_ONLY");
    expect(classifyCountyAccessibility({ ...base, httpStatus: 404 }).status).toBe("NOT_FOUND");
    expect(classifyCountyAccessibility({ ...base, httpStatus: 503 }).status).toBe("TEMPORARILY_UNAVAILABLE");
  });

  it("does not call an accessible page automated without a reviewed structured adapter", () => {
    expect(requireReviewedCountyAdapter({ status: "AUTOMATED", hasStructuredEndpoint: true }).status).toBe("NEEDS_REVIEW");
    expect(requireReviewedCountyAdapter({ status: "AUTOMATED", adapterVersion: "1", parserVersion: "1", hasStructuredEndpoint: true }).status).toBe("AUTOMATED");
  });
});
