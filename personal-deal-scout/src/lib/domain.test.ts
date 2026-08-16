import { describe, expect, it } from "vitest";

import { propertyInputSchema, leadInputSchema, __testables, type DeveloperProjectRecord, type DeveloperRecord, type PropertyRecord } from "./database";
import { approvedMessage, auditEntry, canSendOutbound, completedTask, normalizedPropertyKey } from "./domain";

describe("production foundation business rules", () => {
  it("validates creating a property", () => {
    expect(propertyInputSchema.parse({ address: "10 Main St", city: "Houston", state: "TX", zipCode: "77002", ownerName: "Owner One" }).address).toBe("10 Main St");
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
    const property = { id: "p1", address: "10 Main", city: "Houston", state: "TX", zipCode: "77002", ownerName: "Owner", opportunityStatus: "GOVERNMENT_SALE", contactPhone: "713-555-0100", sourceUrl: "https://example.gov/property", confidence: 90, createdAt: "", updatedAt: "" } satisfies PropertyRecord;
    const developer = (id: string, targetZipCodes: string[]): DeveloperRecord => ({ id, companyName: id, phone: "713-555-0101", email: `${id}@example.com`, targetZipCodes, active: true, qualificationStatus: "QUALIFIED", createdAt: "", updatedAt: "" });
    const purchase = (developerId: string): DeveloperProjectRecord => ({ id: `purchase-${developerId}`, developerId, address: "1 Prior St", city: "Houston", state: "TX", zipCode: "77002", sourceUrl: "https://example.gov/deed", verifiedAt: "2026-08-15", confidence: 90, createdAt: "", updatedAt: "" });
    const matches = __testables.calculateMatches(property, [developer("same", ["77002"]), developer("other", ["77003"])], [purchase("same"), purchase("other")]);
    expect(matches[0]?.developerId).toBe("same");
  });

  it("requires verified purchase history before qualification", () => {
    const developer = { phone: "713-555-0100", email: "buyer@example.com", contactName: "Buyer" };
    expect(__testables.qualificationFor(developer, 0)).toBe("RESEARCH_NEEDED");
    expect(__testables.qualificationFor(developer, 1)).toBe("PRIORITY");
  });
});
