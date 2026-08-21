export function evaluateExternalProviderRequest(input: { status: "DISABLED" | "MOCK_ONLY" | "READY" | "ACTIVE" | "PAUSED" | "CIRCUIT_OPEN"; liveRequestsEnabled: boolean; nextEligibleAt?: Date | null; circuitOpenUntil?: Date | null; quotaRemaining?: number | null; deadlineAt: number; now: Date }) {
  const blockers: string[] = [];
  if (input.status !== "ACTIVE") blockers.push("provider_not_active");
  if (!input.liveRequestsEnabled) blockers.push("live_requests_disabled");
  if (input.nextEligibleAt && input.nextEligibleAt > input.now) blockers.push("cooldown_active");
  if (input.circuitOpenUntil && input.circuitOpenUntil > input.now) blockers.push("circuit_open");
  if (input.quotaRemaining !== null && input.quotaRemaining !== undefined && input.quotaRemaining <= 0) blockers.push("quota_exhausted");
  if (input.deadlineAt - input.now.getTime() < 30_000) blockers.push("insufficient_route_budget");
  return { allowed: blockers.length === 0, blockers };
}
