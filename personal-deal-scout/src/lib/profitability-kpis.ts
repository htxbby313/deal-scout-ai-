export type ProfitabilityEvent = {
  stage: string;
  market?: string | null;
  projectedNetCents?: bigint | null;
  probabilityWeightedCents?: bigint | null;
  realizedNetCents?: bigint | null;
  discoveredAt: Date;
  closedAt?: Date | null;
};

export function calculateProfitabilityKpis(events: readonly ProfitabilityEvent[]) {
  const projectedPipelineCents = events.reduce((sum, event) => sum + (event.stage === "CLOSED" ? BigInt(0) : event.projectedNetCents ?? BigInt(0)), BigInt(0));
  const probabilityWeightedPipelineCents = events.reduce((sum, event) => sum + (event.stage === "CLOSED" ? BigInt(0) : event.probabilityWeightedCents ?? BigInt(0)), BigInt(0));
  const closed = events.filter((event) => event.stage === "CLOSED" && event.realizedNetCents != null);
  const realizedProfitCents = closed.reduce((sum, event) => sum + (event.realizedNetCents ?? BigInt(0)), BigInt(0));
  const closedDurations = closed.flatMap((event) => event.closedAt ? [Math.max(0, Math.round((event.closedAt.getTime() - event.discoveredAt.getTime()) / 86_400_000))] : []);
  return {
    counts: { total: events.length, closed: closed.length },
    projectedPipelineCents: projectedPipelineCents.toString(),
    probabilityWeightedPipelineCents: probabilityWeightedPipelineCents.toString(),
    realizedProfitCents: realizedProfitCents.toString(),
    averageDiscoveryToCloseDays: closedDurations.length ? closedDurations.reduce((sum, days) => sum + days, 0) / closedDurations.length : null,
    realizedEvidenceCount: closed.length,
  };
}
