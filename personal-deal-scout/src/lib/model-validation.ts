export type OutcomeSample = { status: "CLOSED_ASSIGNED" | "CLOSED_PURCHASED" | "CANCELLED" | "FAILED" | "OPEN"; assignmentFee?: number | null; predictedAssignmentFee?: number | null };

export function buildModelValidationReport(samples: OutcomeSample[], minimumSampleSize = 30) {
  const final = samples.filter((sample) => sample.status !== "OPEN");
  const successful = final.filter((sample) => sample.status === "CLOSED_ASSIGNED" || sample.status === "CLOSED_PURCHASED");
  const paired = final.filter((sample) => sample.assignmentFee !== null && sample.assignmentFee !== undefined && sample.predictedAssignmentFee !== null && sample.predictedAssignmentFee !== undefined);
  const meanAbsoluteError = paired.length ? paired.reduce((sum, sample) => sum + Math.abs(sample.assignmentFee! - sample.predictedAssignmentFee!), 0) / paired.length : null;
  const warnings: string[] = [];
  if (final.length < minimumSampleSize) warnings.push(`Only ${final.length} finalized outcome(s) are available; at least ${minimumSampleSize} are required before performance claims or model tuning.`);
  if (paired.length < minimumSampleSize) warnings.push(`Only ${paired.length} outcome(s) pair a prior prediction with a realized result; predictive accuracy is not established.`);
  return {
    sampleSize: final.length,
    pairedPredictionSampleSize: paired.length,
    successRate: final.length ? successful.length / final.length : null,
    meanAbsoluteError,
    sufficientForPerformanceClaims: final.length >= minimumSampleSize && paired.length >= minimumSampleSize,
    automaticModelChangesAllowed: false,
    warnings,
  };
}
