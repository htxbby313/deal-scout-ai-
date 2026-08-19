export const COUNTY_COVERAGE_STATES = ["AUTOMATED", "MANUAL_ONLY", "RESTRICTED", "PAYWALLED", "TEMPORARILY_UNAVAILABLE", "NOT_FOUND", "NEEDS_REVIEW"] as const;

export function validateCountyIdentity(input: { stateCode: string; countyName: string; fipsCode: string }) {
  const errors: string[] = [];
  if (!/^[A-Z]{2}$/.test(input.stateCode)) errors.push("invalid_state_code");
  if (!input.countyName.trim()) errors.push("county_name_missing");
  if (!/^\d{5}$/.test(input.fipsCode)) errors.push("invalid_fips_code");
  return { valid: errors.length === 0, errors };
}

export function evaluateCountyAutomation(input: { automationStatus: "PERMITTED" | "RESTRICTED" | "UNKNOWN" | "PROHIBITED"; authenticationRequired: boolean; subscriptionRequired: boolean; robotsStatus?: string | null; circuitOpenUntil?: Date | null; now: Date }) {
  const blockers: string[] = [];
  if (input.automationStatus !== "PERMITTED") blockers.push(`automation_${input.automationStatus.toLowerCase()}`);
  if (input.authenticationRequired) blockers.push("authentication_required");
  if (input.subscriptionRequired) blockers.push("subscription_required");
  if (input.robotsStatus?.toLowerCase() === "prohibited") blockers.push("robots_prohibited");
  if (input.circuitOpenUntil && input.circuitOpenUntil > input.now) blockers.push("circuit_open");
  return { allowed: blockers.length === 0, blockers };
}

export function classifyCountyObservation(input: { hasSourceRecord: boolean; observedAt: Date; confidence: number; conflictingEvidence: boolean; sourceAllowsAutomation: boolean; now: Date; maxAgeDays: number }) {
  if (!input.sourceAllowsAutomation || !input.hasSourceRecord || input.confidence < 70) return "NEEDS_MANUAL_VERIFICATION" as const;
  if (input.conflictingEvidence) return "CONFLICTED" as const;
  if (input.observedAt > input.now || input.now.getTime() - input.observedAt.getTime() > input.maxAgeDays * 86_400_000) return "EXPIRED" as const;
  return "VERIFIED" as const;
}

export function evaluateEntityMatch(input: { evidenceFactors: readonly string[]; ambiguousName: boolean; conflicts: readonly string[]; reviewedBy?: string; reviewedAt?: Date }) {
  const distinct = new Set(input.evidenceFactors.filter(Boolean));
  if (input.conflicts.length) return { status: "CONFLICTED" as const, reasons: ["conflicting_evidence"] };
  if (input.ambiguousName || distinct.size < 2 || !input.reviewedBy || !input.reviewedAt) return { status: "NEEDS_MANUAL_VERIFICATION" as const, reasons: [input.ambiguousName && "ambiguous_name", distinct.size < 2 && "insufficient_independent_factors", (!input.reviewedBy || !input.reviewedAt) && "review_missing"].filter(Boolean) };
  return { status: "VERIFIED" as const, reasons: [...distinct] };
}

export function countyValueLabel(fieldName: string) {
  return /assessed|taxable/i.test(fieldName) ? "Dated county assessed value — not a market appraisal" : "Official county record observation";
}
