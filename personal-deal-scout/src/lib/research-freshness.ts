export type EvidenceFreshness = "CURRENT" | "STALE" | "MISSING" | "UNVERIFIED_SOURCE" | "INVALID_DATE";

export type PersistedEvidenceSnapshot = {
  topic: string;
  status: string;
  sourceUrl?: string | null;
  observedAt?: string | Date | null;
};

export type PersistedResearchRunSnapshot = {
  status: string;
  startedAt: string | Date;
  finishedAt?: string | Date | null;
};

export type AutomaticResearchPlan = {
  due: boolean;
  reasons: string[];
  staleTopics: string[];
  retryAt: Date | null;
  recoverAbandonedRun: boolean;
};

const PRIVATE_IPV4 = /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|(?:172\.(?:1[6-9]|2\d|3[01])\.))/;
const PRIVATE_HOSTS = new Set(["localhost", "::1", "[::1]", "0.0.0.0"]);

export function isSafePublicEvidenceUrl(raw: string | null | undefined) {
  if (!raw?.trim()) return false;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && !PRIVATE_HOSTS.has(host)
      && !host.endsWith(".local")
      && !host.endsWith(".internal")
      && !PRIVATE_IPV4.test(host);
  } catch {
    return false;
  }
}

function validDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function evidenceFreshness(
  evidence: PersistedEvidenceSnapshot | null | undefined,
  now: Date,
  maxAgeDays: number,
): EvidenceFreshness {
  if (!evidence || evidence.status !== "VERIFIED") return "MISSING";
  if (!isSafePublicEvidenceUrl(evidence.sourceUrl)) return "UNVERIFIED_SOURCE";
  const observedAt = validDate(evidence.observedAt);
  if (!observedAt) return "INVALID_DATE";
  const safeMaxAgeDays = Math.max(1, maxAgeDays);
  return now.getTime() - observedAt.getTime() > safeMaxAgeDays * 86_400_000 ? "STALE" : "CURRENT";
}

export function nextAutomaticRetryAt(finishedAt: string | Date, consecutiveFailures: number) {
  const finished = validDate(finishedAt);
  if (!finished) return null;
  const safeFailures = Math.max(1, Math.floor(consecutiveFailures));
  const delayMinutes = Math.min(24 * 60, 15 * (2 ** Math.min(safeFailures - 1, 7)));
  return new Date(finished.getTime() + delayMinutes * 60_000);
}

export function planAutomaticResearch(input: {
  evidence: readonly PersistedEvidenceSnapshot[];
  expectedTopics: readonly string[];
  latestRun?: PersistedResearchRunSnapshot | null;
  consecutiveFailures?: number;
  now: Date;
  maxAgeDays: number;
  abandonedAfterMinutes?: number;
}): AutomaticResearchPlan {
  const reasons: string[] = [];
  const evidenceByTopic = new Map(input.evidence.map((item) => [item.topic, item]));
  const staleTopics = input.expectedTopics.filter((topic) => evidenceFreshness(
    evidenceByTopic.get(topic),
    input.now,
    input.maxAgeDays,
  ) !== "CURRENT");
  if (staleTopics.length) reasons.push("evidence_refresh_required");

  const latestRun = input.latestRun;
  if (!latestRun) reasons.push("never_researched");

  const abandonedAfterMinutes = Math.max(1, input.abandonedAfterMinutes ?? 30);
  const startedAt = validDate(latestRun?.startedAt);
  const recoverAbandonedRun = latestRun?.status === "RUNNING"
    && Boolean(startedAt && input.now.getTime() - startedAt.getTime() > abandonedAfterMinutes * 60_000);
  if (recoverAbandonedRun) reasons.push("abandoned_run");

  let retryAt: Date | null = null;
  if (latestRun?.status === "FAILED" && latestRun.finishedAt) {
    retryAt = nextAutomaticRetryAt(latestRun.finishedAt, input.consecutiveFailures ?? 1);
    if (retryAt && input.now >= retryAt) reasons.push("failed_run_retry_due");
  }

  const activeRun = latestRun?.status === "QUEUED"
    || (latestRun?.status === "RUNNING" && !recoverAbandonedRun);
  const retryWaiting = latestRun?.status === "FAILED" && retryAt !== null && input.now < retryAt;

  return {
    due: reasons.length > 0 && !activeRun && !retryWaiting,
    reasons,
    staleTopics,
    retryAt,
    recoverAbandonedRun,
  };
}

