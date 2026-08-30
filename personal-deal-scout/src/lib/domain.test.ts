import { describe, expect, it } from "vitest";

import {
  propertyEvidenceUpdateSchema,
  propertyInputSchema,
  propertyRetirementSchema,
  leadInputSchema,
  __testables,
  type DeveloperProjectRecord,
  type DeveloperRecord,
  type PropertyRecord,
} from "./database";
import {
  approvedMessage,
  auditEntry,
  canSendOutbound,
  completedTask,
  normalizedPropertyKey,
  propertyReadiness,
  developerMatchesAreVerified,
  formatSourceRecordDate,
  researchPriorityScore,
} from "./domain";

describe("production foundation business rules", () => {
  it("validates creating a property", () => {
    const property = propertyInputSchema.parse({
      address: "10 Main St",
      city: "Houston",
      state: "TX",
      zipCode: "77002",
      ownerName: "Owner One",
      marketFips: "48201",
      sourceUrl: "https://example.gov/property",
    });
    expect(property).toMatchObject({
      address: "10 Main St",
      marketFips: "48201",
      sourceUrl: "https://example.gov/property",
    });
    expect(() =>
      propertyInputSchema.parse({
        address: "10 Main St",
        city: "Houston",
        state: "TX",
        zipCode: "77002",
        ownerName: "Owner One",
        marketFips: "TX",
      }),
    ).toThrow();
  });

  it("validates creating a lead", () => {
    expect(
      leadInputSchema.parse({
        propertyId: "p1",
        ownerName: "Owner One",
        status: "NEW",
        priority: "High",
        nextActionType: "Research",
        nextActionAt: "Today",
        estimatedAssignmentFee: 50000,
      }).propertyId,
    ).toBe("p1");
  });

  it("prevents property duplicates through a normalized identity", () => {
    expect(normalizedPropertyKey(" 10 MAIN St ", "77002")).toBe(
      normalizedPropertyKey("10 main st", "77002"),
    );
  });

  it("creates and completes a task", () => {
    expect(completedTask({ id: "t1", status: "OPEN" }).status).toBe("DONE");
  });

  it("requires explicit message approval", () => {
    expect(approvedMessage({ id: "m1", status: "PENDING" }).status).toBe(
      "APPROVED",
    );
  });

  it("blocks outbound providers unless every safety gate passes", () => {
    expect(
      canSendOutbound({
        approvalStatus: "APPROVED",
        systemMode: "RESEARCH",
        providerEnabled: false,
        providerConfigured: false,
        environmentConfigured: false,
      }),
    ).toBe(false);
    expect(
      canSendOutbound({
        approvalStatus: "APPROVED",
        systemMode: "ACTIVE",
        providerEnabled: true,
        providerConfigured: true,
        environmentConfigured: true,
      }),
    ).toBe(true);
  });

  it("creates an audit-log payload", () => {
    expect(
      auditEntry("property.created", "Created property.", { propertyId: "p1" }),
    ).toMatchObject({
      type: "property.created",
      details: { propertyId: "p1" },
    });
  });

  it("only returns genuine buy-box matches and ranks the same ZIP first", () => {
    const property = {
      id: "p1",
      address: "10 Main",
      city: "Houston",
      state: "TX",
      zipCode: "77002",
      ownerName: "Owner",
      estimatedValue: 250000,
      opportunityStatus: "GOVERNMENT_SALE",
      contactPhone: "713-555-0100",
      sourceUrl: "https://example.gov/property",
      verificationSourceUrl: "https://example.gov/listing",
      verificationDate: "2026-08-17",
      confidence: 90,
      researchFindings: [],
      media: [],
      researchRuns: [],
      createdAt: "",
      updatedAt: "",
    } satisfies PropertyRecord;
    const developer = (
      id: string,
      targetZipCodes: string[],
    ): DeveloperRecord => ({
      id,
      companyName: id,
      phone: "713-555-0101",
      email: `${id}@example.com`,
      targetZipCodes,
      active: true,
      qualificationStatus: "QUALIFIED",
      researchRuns: [],
      createdAt: "",
      updatedAt: "",
    });
    const purchase = (developerId: string): DeveloperProjectRecord => ({
      id: `purchase-${developerId}`,
      developerId,
      address: "1 Prior St",
      city: "Houston",
      state: "TX",
      zipCode: "77002",
      sourceUrl: "https://example.gov/deed",
      verifiedAt: "2026-08-15",
      confidence: 90,
      createdAt: "",
      updatedAt: "",
    });
    const matches = __testables.calculateMatches(
      property,
      [
        developer("same", ["77002"]),
        developer("other", ["77003"]),
        developer("unknown", []),
      ],
      [purchase("same"), purchase("other")],
    );
    expect(matches[0]?.developerId).toBe("same");
    expect(matches.map((match) => match.developerId)).not.toContain("unknown");
  });

  it("caps each property at five strongest developers", () => {
    const property = {
      id: "p1",
      address: "10 Main",
      city: "Houston",
      state: "TX",
      zipCode: "77002",
      ownerName: "Owner",
      estimatedValue: 250000,
      opportunityStatus: "GOVERNMENT_SALE",
      confidence: 90,
      researchFindings: [],
      media: [],
      researchRuns: [],
      createdAt: "",
      updatedAt: "",
    } satisfies PropertyRecord;
    const developers = Array.from(
      { length: 7 },
      (_, index): DeveloperRecord => ({
        id: `d${index}`,
        companyName: `D${index}`,
        phone: "713-555-0101",
        targetZipCodes: ["77002"],
        active: true,
        qualificationStatus: "QUALIFIED",
        researchRuns: [],
        createdAt: "",
        updatedAt: "",
      }),
    );
    expect(__testables.calculateMatches(property, developers, [])).toHaveLength(
      5,
    );
  });

  it("ranks up to three properties for each eligible developer without requiring a property top-five slot", () => {
    const properties = Array.from(
      { length: 4 },
      (_, index): PropertyRecord => ({
        id: `p${index}`,
        address: `${index} Main`,
        city: "Houston",
        state: "TX",
        zipCode: `7700${index}`,
        ownerName: "Owner",
        estimatedValue: 250000,
        opportunityStatus: "GOVERNMENT_SALE",
        confidence: 70,
        researchFindings: [],
        media: [],
        researchRuns: [],
        createdAt: "",
        updatedAt: "",
      }),
    );
    const developers = Array.from(
      { length: 7 },
      (_, index): DeveloperRecord => ({
        id: `d${index}`,
        companyName: `D${index}`,
        phone: "713-555-0101",
        targetZipCodes: [],
        notes: "Acquisition criteria: Development opportunities in TX",
        active: true,
        qualificationStatus: "QUALIFIED",
        researchRuns: [],
        createdAt: "",
        updatedAt: "",
      }),
    );

    expect(
      __testables.calculateMatches(properties[0], developers, []).map(
        (match) => match.developerId,
      ),
    ).not.toContain("d6");
    expect(
      __testables.calculateDeveloperPropertyMatches(
        "d6",
        properties,
        developers,
        [],
      ),
    ).toHaveLength(3);
  });

  it("uses imported acquisition geography for preliminary relationship matches without treating headquarters as a buy box", () => {
    const property = {
      id: "p1",
      address: "10 Main",
      city: "San Antonio",
      state: "TX",
      zipCode: "78201",
      ownerName: "Owner",
      propertyType: "Land",
      opportunityStatus: "NEEDS_VERIFICATION",
      confidence: 50,
      researchFindings: [],
      media: [],
      researchRuns: [],
      createdAt: "",
      updatedAt: "",
    } satisfies PropertyRecord;
    const base = {
      phone: "713-555-0101",
      targetZipCodes: ["Unknown"],
      active: true,
      qualificationStatus: "QUALIFIED" as const,
      researchRuns: [],
      createdAt: "",
      updatedAt: "",
    };
    const matches = __testables.calculateMatches(
      property,
      [
        {
          ...base,
          id: "texas",
          companyName: "Texas Buyer",
          notes:
            "Target markets: Miami, FL\nProperty types: Land\nAcquisition criteria: Land and development opportunities in TX",
        },
        {
          ...base,
          id: "national",
          companyName: "National Buyer",
          notes:
            "Target markets: Palm Beach, FL\nAcquisition criteria: Ground-up opportunities in major US markets",
        },
        {
          ...base,
          id: "florida",
          companyName: "Florida Buyer",
          notes:
            "Target markets: Dallas, TX\nAcquisition criteria: Multifamily acquisitions in FL",
        },
      ],
      [],
    );
    expect(matches.map((match) => match.developerId)).toEqual([
      "texas",
      "national",
    ]);
    expect(matches[0]?.reasons.join(" ")).toContain(
      "confirm the buy box in conversation",
    );
  });

  it("uses contactability for relationship qualification while purchase history remains matching evidence", () => {
    const developer = {
      phone: "713-555-0100",
      email: "buyer@example.com",
      contactName: "Buyer",
    };
    expect(__testables.qualificationFor(developer, 0)).toBe("PRIORITY");
    expect(
      __testables.qualificationFor(
        {
          phone: null,
          email: null,
          website: "https://builder.example",
          contactName: null,
        },
        0,
      ),
    ).toBe("QUALIFIED");
  });

  it("keeps a sourced property locked until price, contact, and dated verification evidence exist", () => {
    const incomplete = propertyReadiness({
      opportunityStatus: "GOVERNMENT_SALE",
      sourceUrl: "https://example.gov/original",
    });
    expect(incomplete.actionable).toBe(false);
    expect(incomplete.missing).toEqual(
      expect.arrayContaining([
        "current asking price",
        "verified seller or broker phone",
        "price/contact evidence URL",
        "verification date",
      ]),
    );
    expect(
      propertyReadiness({
        opportunityStatus: "GOVERNMENT_SALE",
        sourceUrl: "https://example.gov/original",
        estimatedValue: 125000,
        contactPhone: "713-555-0100",
        verificationSourceUrl: "https://example.gov/listing",
        verificationDate: "2026-08-17",
      }).actionable,
    ).toBe(true);
  });

  it("requires a seller or broker phone even when email exists", () => {
    const base = {
      propertyId: "p1",
      estimatedValue: 125000,
      opportunityStatus: "GOVERNMENT_SALE",
      contactName: "HUD broker",
      verificationSourceUrl: "https://example.gov/listing",
      verificationDate: "2026-08-17",
      confidence: 90,
    };
    expect(() => propertyEvidenceUpdateSchema.parse(base)).toThrow();
    expect(() =>
      propertyEvidenceUpdateSchema.parse({
        ...base,
        contactEmail: "broker@example.gov",
      }),
    ).toThrow();
    expect(
      propertyEvidenceUpdateSchema.parse({
        ...base,
        contactPhone: "713-555-0100",
      }).contactPhone,
    ).toBe("713-555-0100");
  });

  it("accepts an official land-submission route without inventing an acquisitions email", () => {
    const developer = {
      phone: "210-555-0100",
      email: null,
      contactName: "Land acquisition team",
      contactUrl: "https://builder.example/land-submission",
    };
    expect(__testables.qualificationFor(developer, 0)).toBe("PRIORITY");
  });

  it("requires dated source evidence before retiring a stale property", () => {
    const retirement = {
      propertyId: "p1",
      retirementReason: "SOLD",
      verificationSourceUrl: "https://example.gov/closing",
      verificationDate: "2026-08-17",
      confidence: 95,
      notes: "Recorded sale confirms the listing is stale.",
    };
    expect(propertyRetirementSchema.parse(retirement).retirementReason).toBe(
      "SOLD",
    );
    expect(() =>
      propertyRetirementSchema.parse({
        ...retirement,
        verificationSourceUrl: "",
      }),
    ).toThrow();
  });

  it("formats source timestamps without exposing raw database values", () => {
    expect(formatSourceRecordDate("1787636121157")).toMatch(/2026/);
    expect(formatSourceRecordDate("not-a-date")).toBe("Unrecognized date");
    expect(formatSourceRecordDate()).toBe("Missing");
  });

  it("keeps developer scores locked until the property is disposition ready", () => {
    expect(
      developerMatchesAreVerified({
        opportunityStatus: "NEEDS_VERIFICATION",
        sourceUrl: null,
      }),
    ).toBe(false);
    expect(
      developerMatchesAreVerified({
        opportunityStatus: "GOVERNMENT_SALE",
        sourceUrl: "https://example.gov/original",
        estimatedValue: 125000,
        contactPhone: "713-555-0100",
        verificationSourceUrl: "https://example.gov/listing",
        verificationDate: "2026-08-17",
      }),
    ).toBe(true);
  });

  it("prioritizes evidence-rich research candidates deterministically", () => {
    const unverified = researchPriorityScore({
      opportunityStatus: "NEEDS_VERIFICATION",
      confidence: 0,
    });
    const evidenceRich = researchPriorityScore({
      opportunityStatus: "GOVERNMENT_SALE",
      confidence: 80,
      sourceUrl: "https://example.gov/original",
      verificationSourceUrl: "https://example.gov/listing",
      verificationDate: "2026-08-17",
      estimatedValue: 125000,
      contactPhone: "713-555-0100",
    });
    expect(evidenceRich).toBeGreaterThan(unverified);
  });
});
