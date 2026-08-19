import { describe, expect, it } from "vitest";
import { classifyCountyObservation, countyValueLabel, evaluateCountyAutomation, evaluateEntityMatch, validateCountyIdentity } from "@/lib/county-source-policy";

describe("county source policy", () => {
  const now = new Date("2026-08-19T12:00:00Z");
  it("requires a real state, county, and five-digit FIPS", () => expect(validateCountyIdentity({ stateCode: "TX", countyName: "Hudspeth", fipsCode: "48229" })).toEqual({ valid: true, errors: [] }));
  it("fails automation closed for unknown, restricted, paid, authenticated, robots-blocked, or open-circuit sources", () => expect(evaluateCountyAutomation({ automationStatus: "UNKNOWN", authenticationRequired: true, subscriptionRequired: true, robotsStatus: "prohibited", circuitOpenUntil: new Date("2026-08-20"), now }).allowed).toBe(false));
  it("keeps weak, stale, inaccessible, and conflicted observations out of verified facts", () => {
    expect(classifyCountyObservation({ hasSourceRecord: true, observedAt: now, confidence: 90, conflictingEvidence: true, sourceAllowsAutomation: true, now, maxAgeDays: 30 })).toBe("CONFLICTED");
    expect(classifyCountyObservation({ hasSourceRecord: false, observedAt: now, confidence: 90, conflictingEvidence: false, sourceAllowsAutomation: true, now, maxAgeDays: 30 })).toBe("NEEDS_MANUAL_VERIFICATION");
  });
  it("requires review and multiple independent factors for entity matches", () => expect(evaluateEntityMatch({ evidenceFactors: ["name"], ambiguousName: true, conflicts: [] }).status).toBe("NEEDS_MANUAL_VERIFICATION"));
  it("never labels assessed value as market value", () => expect(countyValueLabel("totalAssessedValue")).toContain("not a market appraisal"));
});
