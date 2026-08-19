export type ExecutiveKpiInput = {
  transactions: readonly { id: string; status: string; controlStatus: string }[];
  projections: readonly { transactionId: string; version: number; feeBaseCents: bigint; probabilityWeightedCents: bigint }[];
  settlements: readonly { transactionId: string; version: number; realizedProfitCents: bigint }[];
  contractedScores: readonly { funnelId: string; version: number; contractedFeeCents?: bigint | null }[];
  funnels: readonly { id: string; stage: string }[];
  campaigns: readonly { status: string; outboundEnabled: boolean }[];
  coverage: readonly { funnelId: string; role: string; status: string; expiresAt: Date | string }[];
  now: Date;
};

function latestBy<T>(records: readonly T[], key: (record: T) => string, version: (record: T) => number) {
  const latest = new Map<string, T>();
  for (const record of records) {
    const current = latest.get(key(record));
    if (!current || version(record) > version(current)) latest.set(key(record), record);
  }
  return [...latest.values()];
}

function countBy(records: readonly string[]) {
  return Object.fromEntries([...new Set(records)].sort().map((value) => [value, records.filter((item) => item === value).length]));
}

export function buildExecutiveKpis(input: ExecutiveKpiInput) {
  const liveTransactionIds = new Set(input.transactions.filter((item) => item.status !== "CANCELLED").map((item) => item.id));
  const projections = latestBy(input.projections, (item) => item.transactionId, (item) => item.version).filter((item) => liveTransactionIds.has(item.transactionId));
  const settlements = latestBy(input.settlements, (item) => item.transactionId, (item) => item.version);
  const contracted = latestBy(input.contractedScores, (item) => item.funnelId, (item) => item.version);
  const sum = (values: readonly bigint[]) => values.reduce((total, value) => total + value, BigInt(0));
  const liveCoverage = input.coverage.filter((item) => item.status === "CONFIRMED" && new Date(item.expiresAt) > input.now);
  const coveredFunnels = new Set(liveCoverage.filter((item) => item.role === "PRIMARY").map((item) => item.funnelId).filter((funnelId) => liveCoverage.some((item) => item.funnelId === funnelId && item.role === "BACKUP")));

  return {
    generatedAt: input.now.toISOString(),
    financials: {
      projectedBaseCents: sum(projections.map((item) => item.feeBaseCents)).toString(),
      probabilityWeightedCents: sum(projections.map((item) => item.probabilityWeightedCents)).toString(),
      contractedFeeCents: sum(contracted.flatMap((item) => item.contractedFeeCents == null ? [] : [item.contractedFeeCents])).toString(),
      realizedProfitCents: sum(settlements.map((item) => item.realizedProfitCents)).toString(),
      projectedDealCount: projections.length,
      contractedDealCount: contracted.filter((item) => item.contractedFeeCents != null).length,
      realizedDealCount: settlements.length,
    },
    funnel: { total: input.funnels.length, byStage: countBy(input.funnels.map((item) => item.stage)), withPrimaryAndBackup: coveredFunnels.size },
    transactions: {
      total: input.transactions.length,
      stopped: input.transactions.filter((item) => item.controlStatus === "STOPPED").length,
      onHold: input.transactions.filter((item) => item.controlStatus === "ON_HOLD").length,
      completed: input.transactions.filter((item) => item.status === "COMPLETED").length,
    },
    campaigns: {
      total: input.campaigns.length,
      byStatus: countBy(input.campaigns.map((item) => item.status)),
      outboundEnabled: input.campaigns.filter((item) => item.outboundEnabled).length,
    },
  };
}
