export type LuxuryModelProperty = {
  estimatedValue?: number | null;
  yearBuilt?: string | null;
  lotSize?: string | null;
  opportunityStatus: string;
  researchFindings: ReadonlyArray<{ topic: string; status: string; sourceUrl?: string | null }>;
  media: ReadonlyArray<{ sourceUrl: string }>;
  matches: ReadonlyArray<{ score: number }>;
};

const REQUIRED_FACTS = ["LISTING", "LOCATION", "PRICE", "CONTACT"] as const;

export function evaluateLuxuryRedevelopmentFit(property: LuxuryModelProperty, currentYear = new Date().getUTCFullYear()) {
  const verified = new Map(property.researchFindings.filter((finding) => finding.status === "VERIFIED" && Boolean(finding.sourceUrl)).map((finding) => [finding.topic, finding]));
  const blockers: string[] = [];
  const signals: string[] = [];
  let score = 0;

  const missing = REQUIRED_FACTS.filter((topic) => !verified.has(topic));
  if (missing.length) blockers.push(`source-backed facts missing: ${missing.join(", ").toLowerCase()}`);
  else score += 25;

  if ((property.estimatedValue ?? 0) >= 2_000_000 && verified.has("PRICE")) { score += 20; signals.push("verified luxury price tier"); }
  else if ((property.estimatedValue ?? 0) >= 1_000_000 && verified.has("PRICE")) { score += 10; signals.push("verified high-value acquisition tier"); }

  const yearBuilt = Number(property.yearBuilt);
  if (Number.isInteger(yearBuilt) && yearBuilt > 1800 && yearBuilt <= currentYear - 20) { score += 15; signals.push("older structure may support redevelopment review"); }
  else if (!Number.isInteger(yearBuilt)) blockers.push("year built not verified");

  if (property.lotSize?.trim()) { score += 10; signals.push("lot size recorded for developer pricing"); }
  else blockers.push("lot size not verified");

  const strongestMatch = Math.max(0, ...property.matches.map((match) => match.score));
  if (strongestMatch >= 70) { score += 20; signals.push("strong qualified developer match"); }
  else blockers.push("qualified developer demand not documented");

  if (property.media.some((item) => item.sourceUrl) && verified.has("PHOTOS")) { score += 10; signals.push("verified-source property photos available"); }
  if (!["CONFIRMED_AVAILABLE", "GOVERNMENT_SALE"].includes(property.opportunityStatus)) blockers.push("current availability not verified");

  return {
    score: Math.min(score, 100),
    eligibleForOwnerReview: blockers.length === 0,
    signals,
    blockers,
    basis: "Verified public property facts, redevelopment characteristics, and documented developer fit. No revenue or closing is guaranteed.",
  };
}
