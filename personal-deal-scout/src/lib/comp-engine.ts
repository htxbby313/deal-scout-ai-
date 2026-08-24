export type CompSubject = {
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFeet?: number | null;
  lotSquareFeet?: number | null;
  yearBuilt?: number | null;
};

export type CompEvidence = CompSubject & {
  id: string;
  address: string;
  distanceMiles: number;
  soldDate: Date;
  soldPriceCents: bigint;
  condition?: string | null;
  sourceUrl: string;
  observedAt: Date;
  verificationStatus: string;
  confidence: number;
};

export type ScoredComp = CompEvidence & {
  score: number;
  reasons: string[];
  excluded: boolean;
};

const variance = (a?: number | null, b?: number | null) =>
  a && b ? Math.abs(a - b) / a : null;

export function evaluateComparableSales(
  subject: CompSubject,
  evidence: readonly CompEvidence[],
  now = new Date(),
) {
  const scored: ScoredComp[] = evidence
    .map((comp) => {
      const reasons: string[] = [];
      let score = Math.max(0, 30 - comp.distanceMiles * 10);
      const ageDays = Math.floor(
        (now.getTime() - comp.soldDate.getTime()) / 86_400_000,
      );
      if (comp.verificationStatus !== "VERIFIED_PUBLIC_RECORD")
        reasons.push("Excluded: sale is not verified public-record evidence.");
      if (!comp.sourceUrl.startsWith("https://"))
        reasons.push("Excluded: source URL is not HTTPS.");
      if (comp.observedAt > now || comp.soldDate > now)
        reasons.push("Excluded: evidence date is in the future.");
      if (ageDays > 730)
        reasons.push("Excluded: sale is older than 24 months.");
      else {
        score += Math.max(0, 25 - ageDays / 30);
        reasons.push(`Sold ${ageDays} days ago.`);
      }
      if (comp.distanceMiles > 5)
        reasons.push("Excluded: sale is more than five miles away.");
      else reasons.push(`${comp.distanceMiles.toFixed(2)} miles from subject.`);
      if (subject.propertyType && comp.propertyType) {
        if (
          subject.propertyType.toLowerCase() === comp.propertyType.toLowerCase()
        ) {
          score += 15;
          reasons.push("Same property type.");
        } else reasons.push("Excluded: property type differs.");
      }
      for (const [label, subjectValue, compValue, weight] of [
        ["square footage", subject.squareFeet, comp.squareFeet, 15],
        ["lot size", subject.lotSquareFeet, comp.lotSquareFeet, 8],
        ["year built", subject.yearBuilt, comp.yearBuilt, 7],
      ] as const) {
        const difference = variance(subjectValue, compValue);
        if (difference !== null) {
          if (difference <= 0.2) {
            score += weight;
            reasons.push(`Comparable ${label}.`);
          } else if (difference > 0.5)
            reasons.push(`Excluded: ${label} differs by more than 50%.`);
        }
      }
      if (
        subject.bedrooms != null &&
        comp.bedrooms != null &&
        Math.abs(subject.bedrooms - comp.bedrooms) <= 1
      ) {
        score += 5;
        reasons.push("Bedroom count is comparable.");
      }
      if (
        subject.bathrooms != null &&
        comp.bathrooms != null &&
        Math.abs(subject.bathrooms - comp.bathrooms) <= 1
      ) {
        score += 5;
        reasons.push("Bathroom count is comparable.");
      }
      const excluded = reasons.some((reason) => reason.startsWith("Excluded:"));
      return {
        ...comp,
        score: Math.max(0, Math.min(100, Math.round(score))),
        reasons,
        excluded,
      };
    })
    .toSorted(
      (a, b) =>
        Number(a.excluded) - Number(b.excluded) ||
        b.score - a.score ||
        a.id.localeCompare(b.id),
    );
  const selected = scored.filter((comp) => !comp.excluded).slice(0, 6);
  if (selected.length < 3)
    return {
      selected,
      scored,
      qualityScore: selected.length
        ? Math.round(
            selected.reduce((sum, comp) => sum + comp.score, 0) /
              selected.length,
          )
        : 0,
      valueLowCents: null,
      valueBaseCents: null,
      valueHighCents: null,
      confidence: "INSUFFICIENT_VERIFIED_DATA" as const,
      disclaimer:
        "Comparable-sales estimate only; not an appraisal or guaranteed value.",
    };
  const prices = selected
    .map((comp) => comp.soldPriceCents)
    .toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const base = prices[Math.floor(prices.length / 2)];
  const qualityScore = Math.round(
    selected.reduce((sum, comp) => sum + comp.score, 0) / selected.length,
  );
  return {
    selected,
    scored,
    qualityScore,
    valueLowCents: prices[0],
    valueBaseCents: base,
    valueHighCents: prices.at(-1)!,
    confidence:
      qualityScore >= 75
        ? ("HIGH" as const)
        : qualityScore >= 55
          ? ("MODERATE" as const)
          : ("LOW" as const),
    disclaimer:
      "Comparable-sales estimate only; not an appraisal or guaranteed value.",
  };
}
