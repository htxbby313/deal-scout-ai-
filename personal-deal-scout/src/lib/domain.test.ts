import { describe, expect, it } from "vitest";

import { propertyEvidenceUpdateSchema, propertyInputSchema, propertyRetirementSchema, leadInputSchema, __testables, type DeveloperProjectRecord, type DeveloperRecord, type PropertyRecord } from "./database";
import { approvedMessage, auditEntry, canSendOutbound, completedTask, normalizedPropertyKey, propertyReadiness } from "./domain";

describe("production foundation business rules", () => {
  it("validates creating a property", () => {
    const property = propertyInputSchema.parse({ address: "10 Main St", city: "Houston", state: "TX", zipCode: "77002", ownerName: "Owner One", marketFips: "48201", sourceUrl: "https://example.gov/property" });
    expect(property).toMatchObject({ address: "10 Main St", marketFips: "48201", sourceUrl: "https://example.gov/property" });
    expect(() => propertyInputSchema.parse({ address: "10 Main St", city: "Houston", state: "TX", zipCode: "77002", ownerName: "Owner One", marketFips: "TX" })).toThrow();
  });

  it("validates creating a lead", () => {
    expect(leadInputSchema.parse({ propertyId: "p1", ownerName: "Owner One", status: "NEW", priority: "High", nextActionType: "Research", nextActionAt: "Today", estimatedAssignmentFee: 50000 }).propertyId).toBe("p1");
  });

  it("prevents property duplicates through a normalized identity", () => {
    expect(normalizedPropertyKey(" 10 MAIN St ", "77002")).toBe(normalizedPropertyKey("10 main st", "77002"));
  });

  it("creates and completes a task", () => {
    expect(completedTask({ id: "t1", status: "OPEN" }).status).toBe("DONE");
  });

  it("requires explicit message approval", () => {
    expect(approvedMessage({ id: "m1", status: "PENDING" }).status).toBe("APPROVED");
  });

  it("blocks outbound providers unless every safety gate passes", () => {
    expect(canSendOutbound({ approvalStatus: "APPROVED", systemMode: "RESEARCH", providerEnabled: false, providerConfigured: false, environmentConfigured: false })).toBe(false);
    expect(canSendOutbound({ approvalStatus: "APPROVED", systemMode: "ACTIVE", providerEnabled: true, providerConfigured: true, environmentConfigured: true })).toBe(true);
  });

  it("creates an audit-log payload", () => {
    expect(auditEntry("property.created", "Created property.", { propertyId: "p1" })).toMatchObject({ type: "property.created", details: { propertyId: "p1" } });
  });

  it("scores a same-ZIP developer above a generic developer", () => {
    const property = { id: "p1", address: "10 Main", city: "Houston", state: "TX", zipCode: "77002", ownerName: "Owner", estimatedValue: 250000, opportunityStatus: "GOVERNMENT_SALE", contactPhone: "713-555-0100", sourceUrl: "https://example.gov/property", verificationSourceUrl: "https://example.gov/listing", verificationDate: "2026-08-17", confidence: 90, researchFindings: [], media: [], researchRuns: [], createdAt: "", updatedAt: "" } satisfies PropertyRecord;
    const developer = (id: string, targetZipCodes: string[]): DeveloperRecord => ({ id, companyName: id, phone: "713-555-0101", email: `${id}@example.com`, targetZipCodes, active: true, qualificationStatus: "QUALIFIED", researchRuns: [], createdAt: "", updatedAt: "" });
    const purchase = (developerId: string): DeveloperProjectRecord => ({ id: `purchase-${developerId}`, developerId, address: "1 Prior St", city: "Houston", state: "TX", zipCode: "77002", sourceUrl: "https://example.gov/deed", verifiedAt: "2026-08-15", confidence: 90, createdAt: "", updatedAt: "" });
    const matches = __testables.calculateMatches(property, [developer("same", ["77002"]), developer("other", ["77003"])], [purchase("same"), purchase("other")]);
    expect(matches[0]?.developerId).toBe("same");
  });

  it("requires verified purchase history before qualification", () => {
    const developer = { phone: "713-555-0100", email: "buyer@example.com", contactName: "Buyer" };
    expect(__testables.qualificationFor(developer, 0)).toBe("RESEARCH_NEEDED");
    expect(__testables.qualificationFor(developer, 1)).toBe("PRIORITY");
  });

  it("keeps a sourced property locked until price, contact, and dated verification evidence exist", () => {
    const incomplete = propertyReadiness({ opportunityStatus: "GOVERNMENT_SALE", sourceUrl: "https://example.gov/original" });
    expect(incomplete.actionable).toBe(false);
    expect(incomplete.missing).toEqual(expect.arrayContaining(["current asking price", "verified seller or broker phone", "price/contact evidence URL", "verification date"]));
    expect(propertyReadiness({ opportunityStatus: "GOVERNMENT_SALE", sourceUrl: "https://example.gov/original", estimatedValue: 125000, contactPhone: "713-555-0100", verificationSourceUrl: "https://example.gov/listing", verificationDate: "2026-08-17" }).actionable).toBe(true);
  });

  it("requires a seller or broker phone even when email exists", () => {
    const base = { propertyId: "p1", estimatedValue: 125000, opportunityStatus: "GOVERNMENT_SALE", contactName: "HUD broker", verificationSourceUrl: "https://example.gov/listing", verificationDate: "2026-08-17", confidence: 90 };
    expect(() => propertyEvidenceUpdateSchema.parse(base)).toThrow();
    expect(() => propertyEvidenceUpdateSchema.parse({ ...base, contactEmail: "broker@example.gov" })).toThrow();
    expect(propertyEvidenceUpdateSchema.parse({ ...base, contactPhone: "713-555-0100" }).contactPhone).toBe("713-555-0100");
  });

  it("accepts an official land-submission route without inventing an acquisitions email", () => {
    const developer = { phone: "210-555-0100", email: null, contactName: "Land acquisition team", contactUrl: "https://builder.example/land-submission" };
    expect(__testables.qualificationFor(developer, 1)).toBe("PRIORITY");
  });

  it("requires dated source evidence before retiring a stale property", () => {
    const retirement = { propertyId: "p1", retirementReason: "SOLD", verificationSourceUrl: "https://example.gov/closing", verificationDate: "2026-08-17", confidence: 95, notes: "Recorded sale confirms the listing is stale." };
    expect(propertyRetirementSchema.parse(retirement).retirementReason).toBe("SOLD");
    expect(() => propertyRetirementSchema.parse({ ...retirement, verificationSourceUrl: "" })).toThrow();
  });
});
