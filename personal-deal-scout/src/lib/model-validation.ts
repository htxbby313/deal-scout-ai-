export type OutcomeSample = { status: "CLOSED_ASSIGNED" | "CLOSED_PURCHASED" | "CANCELLED" | "FAILED" | "OPEN"; assignmentFee?: number | null; predictedAssignmentFee?: number | null;predictedProbabilityBps?:number|null;market?:string|null;assetType?:string|null;buyer?:string|null;strategy?:string|null;leadSource?:string|null };

export function buildModelValidationReport(samples: OutcomeSample[], minimumSampleSize = 30) {
  const final = samples.filter((sample) => sample.status !== "OPEN");
  const successful = final.filter((sample) => sample.status === "CLOSED_ASSIGNED" || sample.status === "CLOSED_PURCHASED");
  const paired = final.filter((sample) => sample.assignmentFee !== null && sample.assignmentFee !== undefined && sample.predictedAssignmentFee !== null && sample.predictedAssignmentFee !== undefined);
  const meanAbsoluteError = paired.length ? paired.reduce((sum, sample) => sum + Math.abs(sample.assignmentFee! - sample.predictedAssignmentFee!), 0) / paired.length : null;
  const probabilityPaired=final.filter(sample=>sample.predictedProbabilityBps!=null);const probabilityAbsoluteErrorBps=probabilityPaired.length?probabilityPaired.reduce((sum,sample)=>sum+Math.abs(sample.predictedProbabilityBps!-(successful.includes(sample)?10_000:0)),0)/probabilityPaired.length:null;
  const warnings: string[] = [];
  if (final.length < minimumSampleSize) warnings.push(`Only ${final.length} finalized outcome(s) are available; at least ${minimumSampleSize} are required before performance claims or model tuning.`);
  if (paired.length < minimumSampleSize) warnings.push(`Only ${paired.length} outcome(s) pair a prior prediction with a realized result; predictive accuracy is not established.`);
  return {
    sampleSize: final.length,
    pairedPredictionSampleSize: paired.length,
    successRate: final.length ? successful.length / final.length : null,
    meanAbsoluteError,
    probabilityPairedSampleSize:probabilityPaired.length,probabilityAbsoluteErrorBps,
    sufficientForPerformanceClaims: final.length >= minimumSampleSize && paired.length >= minimumSampleSize,
    automaticModelChangesAllowed: false,
    warnings,
  };
}

export function evaluateWeightProposalEligibility(input:{finalizedOutcomes:number;pairedFinancialOutcomes:number;pairedProbabilityOutcomes:number;minimumSampleSize?:number}){const minimum=input.minimumSampleSize??30;const blockers=[input.finalizedOutcomes<minimum&&"finalized_sample_too_small",input.pairedFinancialOutcomes<minimum&&"financial_pair_sample_too_small",input.pairedProbabilityOutcomes<minimum&&"probability_pair_sample_too_small"].filter(Boolean)as string[];return{eligible:blockers.length===0,minimumSampleSize:minimum,blockers,automaticApplicationAllowed:false as const};}

export type ForecastErrorSegment = { dimension: "market" | "assetType" | "buyer" | "strategy" | "leadSource"; key: string; finalizedSampleSize: number; financialPairedSampleSize: number; meanAbsoluteFinancialError: number | null; probabilityPairedSampleSize: number; meanAbsoluteProbabilityErrorBps: number | null };

export function buildSegmentedForecastErrors(samples: OutcomeSample[]): ForecastErrorSegment[] {
  const dimensions = ["market", "assetType", "buyer", "strategy", "leadSource"] as const;
  return dimensions.flatMap((dimension) => {
    const groups = new Map<string, OutcomeSample[]>();
    for (const sample of samples) {
      if (sample.status === "OPEN") continue;
      const key = sample[dimension]?.trim() || "UNSPECIFIED";
      groups.set(key, [...(groups.get(key) ?? []), sample]);
    }
    return [...groups.entries()].map(([key, group]) => {
      const financial = group.filter((item) => item.assignmentFee != null && item.predictedAssignmentFee != null);
      const probability = group.filter((item) => item.predictedProbabilityBps != null);
      return { dimension, key, finalizedSampleSize: group.length, financialPairedSampleSize: financial.length,
        meanAbsoluteFinancialError: financial.length ? financial.reduce((sum, item) => sum + Math.abs(item.assignmentFee! - item.predictedAssignmentFee!), 0) / financial.length : null,
        probabilityPairedSampleSize: probability.length,
        meanAbsoluteProbabilityErrorBps: probability.length ? probability.reduce((sum, item) => sum + Math.abs(item.predictedProbabilityBps! - (["CLOSED_ASSIGNED", "CLOSED_PURCHASED"].includes(item.status) ? 10_000 : 0)), 0) / probability.length : null };
    });
  });
}
