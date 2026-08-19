import { describe, expect, it } from "vitest";
import { OUTCOME_REASON_CODES, outcomeReasonCoverage, validateOutcomeReason } from "./outcome-reasons";
describe("structured outcome reasons", () => {
  it("covers every required outcome family", () => { expect(OUTCOME_REASON_CODES).toHaveLength(22); expect(OUTCOME_REASON_CODES).toContain("OWNER_STOPPED_TRANSACTION"); expect(OUTCOME_REASON_CODES).toContain("EVIDENCE_COULD_NOT_BE_VERIFIED"); });
  it("requires success and failure reasons to agree with outcome status", () => { expect(validateOutcomeReason({ status: "CLOSED_ASSIGNED", reasonCode: "CLOSED_SUCCESSFULLY" }).valid).toBe(true); expect(validateOutcomeReason({ status: "FAILED", reasonCode: "CLOSED_SUCCESSFULLY" }).valid).toBe(false); });
  it("requires an explanation for other and reports missing coverage", () => { expect(validateOutcomeReason({ status: "FAILED", reasonCode: "OTHER" }).blockers).toContain("other_reason_requires_explanation"); expect(outcomeReasonCoverage([{ reasonCode: "TITLE_DEFECT" }, { reasonCode: null }])).toEqual({ covered: 1, total: 2, percent: 50 }); });
});
