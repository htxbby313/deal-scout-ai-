export const AUTOMATIC_RESEARCH_TASK_TYPES = ["RESEARCH_PROPERTY", "RESEARCH_DEVELOPER", "VERIFY_PUBLIC_SOURCE"] as const;
export type AutomaticResearchTaskType = (typeof AUTOMATIC_RESEARCH_TASK_TYPES)[number];

export const RESEARCH_MAX_ATTEMPTS = 3;
export const RESEARCH_STALE_AFTER_MS = 30 * 60_000;

export function isAutomaticResearchTask(taskType: string): taskType is AutomaticResearchTaskType {
  return AUTOMATIC_RESEARCH_TASK_TYPES.includes(taskType as AutomaticResearchTaskType);
}

export function researchRetryDelayMs(attemptCount: number) {
  if (attemptCount <= 0) return 0;
  return Math.min(15 * 60_000 * (2 ** (attemptCount - 1)), 2 * 60 * 60_000);
}

export function researchRetryDecision(input: { attemptCount: number; failedAt: Date; now?: Date }) {
  const now = input.now ?? new Date();
  if (input.attemptCount >= RESEARCH_MAX_ATTEMPTS) return { retry: false, retryAt: null };
  const retryAt = new Date(input.failedAt.getTime() + researchRetryDelayMs(input.attemptCount));
  return { retry: retryAt <= now, retryAt };
}

