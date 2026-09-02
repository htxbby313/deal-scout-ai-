import { evaluateStoredProfitPriority } from "@/lib/profit-priority";

export type StoredProfitPriorityHistory = {
  totalScore: number;
  projectedProfitScore: number;
  probabilityScore: number;
  sellerFitScore: number;
  evidenceScore: number;
  buyerCoverageScore: number;
  velocityScore: number;
  riskPenaltyScore: number;
  reasons: readonly string[];
  blockers: readonly string[];
  expiresAt: Date;
};

export type DealScoreView = {
  displayScore: number | null;
  label: string | null;
  explanation: string | null;
};

const REASON_COPY: Record<string, string> = {
  projected_profit: "projected spread is strong",
  probability_weighted_profit: "probability-weighted profit is strong",
  evidence_ready: "evidence is ready",
  buyer_coverage: "buyer coverage is ready",
};

const BLOCKER_COPY: Record<string, string> = {
  evidence_incomplete: "evidence is incomplete",
  buyer_coverage_incomplete: "buyer coverage is incomplete",
  risk_high: "risk is high",
  transaction_stopped: "the transaction is stopped",
  inactive_funnel_stage: "this deal is inactive",
  priority_score_expired: "the score has expired",
};

function humanizeCode(code: string, dictionary: Record<string, string>) {
  return dictionary[code] ?? code.replaceAll("_", " ");
}

function strengthClause(reasons: readonly string[]) {
  const known = reasons.filter((code) => code.length > 0);
  const hasBuyer = known.includes("buyer_coverage");
  const hasEvidence = known.includes("evidence_ready");
  const parts: string[] = [];
  if (hasBuyer && hasEvidence) {
    parts.push("buyer coverage and evidence are ready");
  } else {
    if (hasBuyer) parts.push(REASON_COPY.buyer_coverage);
    if (hasEvidence) parts.push(REASON_COPY.evidence_ready);
  }
  for (const code of known) {
    if (code === "buyer_coverage" || code === "evidence_ready") continue;
    parts.push(humanizeCode(code, REASON_COPY));
  }
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function caveatClause(
  history: StoredProfitPriorityHistory,
  reasons: readonly string[],
) {
  if (
    !reasons.includes("projected_profit") &&
    history.projectedProfitScore < 70
  ) {
    return "projected spread is thin";
  }
  return null;
}

export function explainStoredDealScore(history: StoredProfitPriorityHistory) {
  const strengths = strengthClause(history.reasons);
  const caveat = caveatClause(history, history.reasons);
  if (strengths && caveat) {
    return `Score ${history.totalScore}: ${strengths}; ${caveat}.`;
  }
  if (strengths) {
    return `Score ${history.totalScore}: ${strengths}.`;
  }
  if (caveat) {
    return `Score ${history.totalScore}: ${caveat}.`;
  }
  return `Score ${history.totalScore}: stored factors do not yet show a ready spread, evidence, or buyer coverage.`;
}

export function explainDealScore(input: {
  history?: StoredProfitPriorityHistory | null;
  stage?: string | null;
  controlStatus?: string | null;
  now?: Date;
}): DealScoreView {
  if (!input.history) {
    return { displayScore: null, label: null, explanation: null };
  }
  const evaluated = evaluateStoredProfitPriority({
    score: input.history.totalScore,
    blockers: input.history.blockers,
    expiresAt: input.history.expiresAt,
    stage: input.stage ?? "DISCOVERED",
    controlStatus: input.controlStatus,
    now: input.now ?? new Date(),
  });
  if (!evaluated.eligible || evaluated.visibleScore == null) {
    const blocker = evaluated.blockers[0];
    return {
      displayScore: null,
      label: "Deal Score unavailable",
      explanation: blocker
        ? humanizeCode(blocker, BLOCKER_COPY)
        : "the stored score is not eligible",
    };
  }
  return {
    displayScore: evaluated.visibleScore,
    label: `Deal Score ${evaluated.visibleScore}`,
    explanation: explainStoredDealScore(input.history),
  };
}
