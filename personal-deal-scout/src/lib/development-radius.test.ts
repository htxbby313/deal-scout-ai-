import { describe, expect, it } from "vitest";
import {
  developmentDistanceBand,
  distanceMilesBetween,
  isVerifiedDevelopmentEvidence,
  matchPropertiesToVerifiedDevelopments,
  rankPropertiesByDevelopmentEvidence,
  type PersistedDevelopmentEvidence,
  type PersistedPropertyLocation,
} from "@/lib/development-radius";

const property = (overrides: Partial<PersistedPropertyLocation> = {}): PersistedPropertyLocation => ({
  propertyId: "property-a",
  latitude: 29.4241,
  longitude: -98.4936,
  stateCode: "TX",
  countryCode: "US",
  ...overrides,
});

const development = (overrides: Partial<PersistedDevelopmentEvidence> = {}): PersistedDevelopmentEvidence => ({
  developmentId: "development-a",
  latitude: 29.4969,
  longitude: -98.4936,
  stateCode: "TX",
  countryCode: "US",
  verificationStatus: "VERIFIED",
  sourceUrl: "https://example.gov/permit/123",
  verifiedAt: "2026-08-18T12:00:00.000Z",
  confidence: 0.9,
  ...overrides,
});

describe("development radius intelligence", () => {
  it("calculates geodesic miles and assigns exact, non-overlapping bands", () => {
    expect(distanceMilesBetween(property(), development())).toBeCloseTo(5.03, 1);
    expect(developmentDistanceBand(0)).toBe("0-5");
    expect(developmentDistanceBand(5)).toBe("0-5");
    expect(developmentDistanceBand(5.0001)).toBe("5-10");
    expect(developmentDistanceBand(10)).toBe("5-10");
    expect(developmentDistanceBand(10.0001)).toBe("10-15");
    expect(developmentDistanceBand(15)).toBe("10-15");
    expect(developmentDistanceBand(15.0001)).toBeNull();
  });

  it("accepts only persisted, sourced, verified United States evidence", () => {
    expect(isVerifiedDevelopmentEvidence(development())).toBe(true);
    expect(isVerifiedDevelopmentEvidence(development({ verificationStatus: "PENDING" }))).toBe(false);
    expect(isVerifiedDevelopmentEvidence(development({ sourceUrl: "" }))).toBe(false);
    expect(isVerifiedDevelopmentEvidence(development({ verifiedAt: "" }))).toBe(false);
    expect(isVerifiedDevelopmentEvidence(development({ countryCode: "CA" }))).toBe(false);
    expect(isVerifiedDevelopmentEvidence(development({ stateCode: "PR" }))).toBe(false);
  });

  it("excludes non-US properties, unverified signals, and matches beyond 15 miles", () => {
    const matches = matchPropertiesToVerifiedDevelopments(
      [property(), property({ propertyId: "foreign", countryCode: "MX" })],
      [
        development(),
        development({ developmentId: "unverified", verificationStatus: "PENDING" }),
        development({ developmentId: "far", latitude: 29.75 }),
      ],
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      propertyId: "property-a",
      developmentId: "development-a",
      distanceBand: "5-10",
      sourceUrl: "https://example.gov/permit/123",
    });
  });

  it("ranks deterministically from verified distance and evidence fields", () => {
    const matches = matchPropertiesToVerifiedDevelopments(
      [
        property({ propertyId: "one" }),
        property({ propertyId: "two", latitude: 29.43 }),
      ],
      [
        development(),
        development({ developmentId: "development-b", latitude: 29.51, confidence: 0.7 }),
      ],
    );
    const ranked = rankPropertiesByDevelopmentEvidence(matches);

    expect(ranked.map(({ rank, propertyId }) => ({ rank, propertyId }))).toEqual([
      { rank: 1, propertyId: "two" },
      { rank: 2, propertyId: "one" },
    ]);
    expect(ranked[0]).toMatchObject({
      strongestBand: "0-5",
      verifiedEvidenceCount: 2,
      highestConfidence: 0.9,
    });
  });

  it("rejects invalid coordinates instead of creating inferred matches", () => {
    expect(distanceMilesBetween(property(), development({ latitude: 91 }))).toBeNull();
    expect(matchPropertiesToVerifiedDevelopments(
      [property({ longitude: Number.NaN })],
      [development()],
    )).toEqual([]);
  });
});
