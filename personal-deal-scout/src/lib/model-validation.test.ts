import { describe, expect, it } from "vitest";
import { buildModelValidationReport } from "@/lib/model-validation";

describe("outcome model validation", () => {
  it("warns against claims and tuning with a tiny sample", () => {
    const report = buildModelValidationReport([{ status: "CLOSED_ASSIGNED", assignmentFee: 15_000, predictedAssignmentFee: 20_000 }]);
    expect(report.sufficientForPerformanceClaims).toBe(false);
    expect(report.automaticModelChangesAllowed).toBe(false);
    expect(report.warnings.length).toBe(2);
  });
  it("computes error only from prediction/outcome pairs", () => {
    const report = buildModelValidationReport([{ status: "CLOSED_ASSIGNED", assignmentFee: 10_000, predictedAssignmentFee: 12_000 }, { status: "FAILED" }], 1);
    expect(report.meanAbsoluteError).toBe(2_000);
    expect(report.pairedPredictionSampleSize).toBe(1);
  });
});
