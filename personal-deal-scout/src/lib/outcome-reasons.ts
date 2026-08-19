export const OUTCOME_REASON_CODES = [
  "CLOSED_SUCCESSFULLY", "SELLER_REJECTED_PRICE", "SELLER_CHOSE_ANOTHER_BUYER", "SELLER_WITHDREW", "UNABLE_TO_CONTACT",
  "BUYER_REJECTED", "BUYER_RETRADED", "BUYER_FAILED_TO_CLOSE", "TITLE_DEFECT", "OWNERSHIP_OR_AUTHORITY_PROBLEM",
  "ZONING_OR_LAND_USE_ISSUE", "ACCESS_EASEMENT_UTILITY_ISSUE", "FLOOD_WETLAND_ENVIRONMENTAL_ISSUE", "SURVEY_OR_FEASIBILITY_ISSUE",
  "FINANCING_FAILURE", "INSPECTION_OR_CONDITION_ISSUE", "LEGAL_OR_COMPLIANCE_BLOCK", "SPREAD_BELOW_TARGET", "COST_OVERRUN",
  "EVIDENCE_COULD_NOT_BE_VERIFIED", "OWNER_STOPPED_TRANSACTION", "OTHER",
] as const;
export type OutcomeReasonCode = typeof OUTCOME_REASON_CODES[number];

export function validateOutcomeReason(input: { status: "CLOSED_ASSIGNED" | "CLOSED_PURCHASED" | "CANCELLED" | "FAILED"; reasonCode: OutcomeReasonCode; explanation?: string }) {
  const blockers: string[] = [];
  const closed = input.status === "CLOSED_ASSIGNED" || input.status === "CLOSED_PURCHASED";
  if (closed && input.reasonCode !== "CLOSED_SUCCESSFULLY") blockers.push("closed_outcome_requires_success_reason");
  if (!closed && input.reasonCode === "CLOSED_SUCCESSFULLY") blockers.push("unsuccessful_outcome_requires_failure_reason");
  if (input.reasonCode === "OTHER" && (input.explanation?.trim().length ?? 0) < 10) blockers.push("other_reason_requires_explanation");
  return { valid: blockers.length === 0, blockers };
}

export function outcomeReasonCoverage(outcomes: readonly { reasonCode?: string | null }[]) {
  const covered = outcomes.filter((item) => Boolean(item.reasonCode?.trim())).length;
  return { covered, total: outcomes.length, percent: outcomes.length ? Math.round((covered / outcomes.length) * 1000) / 10 : null };
}
