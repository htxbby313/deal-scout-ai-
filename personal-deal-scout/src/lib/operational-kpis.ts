export type Metric = {
  key: string;
  label: string;
  definition: string;
  value: number | string | null;
  numerator: number | string | null;
  denominator: number | string | null;
  unit: "count" | "percent" | "hours" | "cents";
  windowStart: string;
  windowEnd: string;
  lastRefresh: string;
  sampleSize: number;
  warning?: string;
};
type Timed = { createdAt: Date | string };
export type OperationalKpiInput = {
  properties: readonly (Timed & {
    researched: boolean;
    researchException: boolean;
  })[];
  funnels: readonly (Timed & {
    stage: string;
    stageEnteredAt: Date | string;
    stageHistory: readonly {
      fromStage?: string | null;
      toStage: string;
      occurredAt: Date | string;
      exitedAt?: Date | string | null;
    }[];
  })[];
  engagements: readonly (Timed & {
    ownerApproved: boolean;
    attempts: readonly { status: string; attemptedAt?: Date | string | null }[];
    conversations: readonly { occurredAt: Date | string }[];
    offers: readonly {
      status: string;
      createdAt: Date | string;
      deliveredAt?: Date | string | null;
    }[];
  })[];
  transactions: readonly (Timed & {
    status: string;
    controlStatus: string;
    contractedAt?: Date | string | null;
    closedAt?: Date | string | null;
  })[];
  outcomes: readonly (Timed & { reason?: string | null; closed: boolean })[];
  buyerEvidence: readonly {
    completedClosings: number;
    failedClosings: number;
    retrades: number;
    responsesMeasured: number;
  }[];
  costs: readonly { type: string; amountCents: bigint }[];
  profits: {
    projectedCents: bigint;
    weightedCents: bigint;
    contractedCents: bigint;
    realizedCents: bigint;
    realizedValues: readonly bigint[];
  };
  evidence: readonly { status: string; observedAt: Date | string }[];
  approvals: readonly { status: string; requestedAt: Date | string }[];
  agentTasks: readonly {
    status: string;
    attemptCount: number;
    createdAt: Date | string;
  }[];
  windowStart: Date;
  windowEnd: Date;
  refreshedAt: Date;
};
const hours = (milliseconds: number) =>
  Math.round((milliseconds / 3_600_000) * 10) / 10;
const average = (values: readonly number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const median = (values: readonly number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
export function buildOperationalKpis(input: OperationalKpiInput) {
  const windowStart = input.windowStart.toISOString(),
    windowEnd = input.windowEnd.toISOString(),
    lastRefresh = input.refreshedAt.toISOString();
  const metric = (
    key: string,
    label: string,
    definition: string,
    value: number | string | null,
    numerator: number | string | null,
    denominator: number | string | null,
    unit: Metric["unit"],
    sampleSize: number,
  ): Metric => ({
    key,
    label,
    definition,
    value,
    numerator,
    denominator,
    unit,
    windowStart,
    windowEnd,
    lastRefresh,
    sampleSize,
    ...(sampleSize > 0 && sampleSize < 30
      ? { warning: "Small sample; interpret cautiously." }
      : {}),
  });
  const researched = input.properties.filter((p) => p.researched).length,
    exceptions = input.properties.filter((p) => p.researchException).length;
  const attempts = input.engagements.flatMap((e) => e.attempts),
    reachedEngagements = input.engagements.filter(
      (engagement) => engagement.conversations.length > 0,
    ),
    conversations = input.engagements.flatMap((e) => e.conversations),
    offers = input.engagements.flatMap((e) => e.offers);
  const deliveredOffers = offers.filter(
    (o) => o.status === "DELIVERED_MANUALLY",
  ).length;
  const closed = input.outcomes.filter((o) => o.closed).length;
  const stageDurations = input.funnels.flatMap((f) =>
    f.stageHistory.flatMap((h) =>
      h.exitedAt
        ? [
            hours(
              new Date(h.exitedAt).getTime() - new Date(h.occurredAt).getTime(),
            ),
          ]
        : [],
    ),
  );
  const discoveryToContact = input.engagements.flatMap((e) =>
    e.attempts.flatMap((a) =>
      a.attemptedAt
        ? [
            hours(
              new Date(a.attemptedAt).getTime() -
                new Date(e.createdAt).getTime(),
            ),
          ]
        : [],
    ),
  );
  const totalCost = input.costs.reduce(
    (sum, c) => sum + c.amountCents,
    BigInt(0),
  );
  const costPer = (count: number) =>
    count ? (totalCost / BigInt(count)).toString() : null;
  const buyerCompleted = input.buyerEvidence.reduce(
      (s, b) => s + b.completedClosings,
      0,
    ),
    buyerFailed = input.buyerEvidence.reduce((s, b) => s + b.failedClosings, 0),
    buyerRetrades = input.buyerEvidence.reduce((s, b) => s + b.retrades, 0),
    buyerResponses = input.buyerEvidence.reduce(
      (s, b) => s + b.responsesMeasured,
      0,
    );
  const fresh = input.evidence.filter(
    (e) =>
      e.status === "VERIFIED" &&
      input.refreshedAt.getTime() - new Date(e.observedAt).getTime() <=
        7 * 86_400_000,
  ).length;
  const pendingApprovals = input.approvals.filter(
    (a) => a.status === "PENDING",
  );
  const approvalAges = pendingApprovals.map((a) =>
    hours(input.refreshedAt.getTime() - new Date(a.requestedAt).getTime()),
  );
  const failedTasks = input.agentTasks.filter((t) => t.status === "FAILED");
  const metrics: Metric[] = [
    metric(
      "properties_discovered",
      "Properties discovered",
      "Properties entered during the selected window.",
      input.properties.length,
      input.properties.length,
      null,
      "count",
      input.properties.length,
    ),
    metric(
      "properties_researched",
      "Properties researched",
      "Properties with at least one research run.",
      researched,
      researched,
      input.properties.length,
      "count",
      input.properties.length,
    ),
    metric(
      "research_completion_rate",
      "Research completion rate",
      "Researched properties divided by discovered properties.",
      input.properties.length
        ? Math.round((researched / input.properties.length) * 1000) / 10
        : null,
      researched,
      input.properties.length,
      "percent",
      input.properties.length,
    ),
    metric(
      "research_exception_rate",
      "Research exception rate",
      "Properties with unresolved research exceptions divided by discovered properties.",
      input.properties.length
        ? Math.round((exceptions / input.properties.length) * 1000) / 10
        : null,
      exceptions,
      input.properties.length,
      "percent",
      input.properties.length,
    ),
    metric(
      "outreach_ready",
      "Outreach-ready opportunities",
      "Funnels currently in OUTREACH_READY.",
      input.funnels.filter((f) => f.stage === "OUTREACH_READY").length,
      null,
      input.funnels.length,
      "count",
      input.funnels.length,
    ),
    metric(
      "owner_approved_contacts",
      "Owner-approved contacts",
      "Seller engagements explicitly approved by the owner.",
      input.engagements.filter((e) => e.ownerApproved).length,
      null,
      input.engagements.length,
      "count",
      input.engagements.length,
    ),
    metric(
      "contact_attempts",
      "Contact attempts",
      "Recorded seller contact attempts.",
      attempts.length,
      attempts.length,
      null,
      "count",
      attempts.length,
    ),
    metric(
      "sellers_reached",
      "Sellers reached",
      "Engagements with a sourced conversation.",
      input.engagements.filter((e) => e.conversations.length).length,
      null,
      input.engagements.length,
      "count",
      input.engagements.length,
    ),
    metric(
      "qualified_conversations",
      "Qualified seller conversations",
      "Source-linked seller conversations.",
      conversations.length,
      conversations.length,
      null,
      "count",
      conversations.length,
    ),
    metric(
      "offers_prepared",
      "Offers prepared",
      "All versioned seller offers.",
      offers.length,
      offers.length,
      null,
      "count",
      offers.length,
    ),
    metric(
      "offers_approved",
      "Offers approved",
      "Offers with owner-approved or later status.",
      offers.filter((o) =>
        ["OWNER_APPROVED", "DELIVERED_MANUALLY", "ACCEPTED"].includes(o.status),
      ).length,
      null,
      offers.length,
      "count",
      offers.length,
    ),
    metric(
      "offers_delivered",
      "Offers delivered",
      "Offers recorded as manually delivered.",
      deliveredOffers,
      deliveredOffers,
      offers.length,
      "count",
      offers.length,
    ),
    metric(
      "contracts_signed",
      "Contracts signed",
      "Transactions in UNDER_CONTRACT or later.",
      input.transactions.filter((t) =>
        [
          "UNDER_CONTRACT",
          "BUYER_MATCHING",
          "ASSIGNMENT_PENDING",
          "CLOSING_PENDING",
          "COMPLETED",
        ].includes(t.status),
      ).length,
      null,
      input.transactions.length,
      "count",
      input.transactions.length,
    ),
    metric(
      "deals_closed",
      "Deals closed",
      "Finalized successful outcomes.",
      closed,
      closed,
      input.outcomes.length,
      "count",
      input.outcomes.length,
    ),
    metric(
      "average_stage_hours",
      "Average time in stage",
      "Average completed stage duration.",
      average(stageDurations),
      stageDurations.reduce((total, value) => total + value, 0),
      stageDurations.length,
      "hours",
      stageDurations.length,
    ),
    metric(
      "median_stage_hours",
      "Median time in stage",
      "Median completed stage duration.",
      median(stageDurations),
      null,
      null,
      "hours",
      stageDurations.length,
    ),
    metric(
      "discovery_to_contact_hours",
      "Discovery-to-contact time",
      "Average hours from engagement creation to recorded attempt.",
      average(discoveryToContact),
      discoveryToContact.reduce((total, value) => total + value, 0),
      discoveryToContact.length,
      "hours",
      discoveryToContact.length,
    ),
    metric(
      "cost_per_seller_reached",
      "Cost per seller reached",
      "Attributed costs divided by unique seller engagements with at least one sourced conversation.",
      costPer(reachedEngagements.length),
      totalCost.toString(),
      reachedEngagements.length,
      "cents",
      reachedEngagements.length,
    ),
    metric(
      "cost_per_offer",
      "Cost per offer",
      "Attributed costs divided by offers prepared.",
      costPer(offers.length),
      totalCost.toString(),
      offers.length,
      "cents",
      offers.length,
    ),
    metric(
      "cost_per_closed_transaction",
      "Cost per closed transaction",
      "Attributed costs divided by successful closed outcomes.",
      costPer(closed),
      totalCost.toString(),
      closed,
      "cents",
      closed,
    ),
    metric(
      "projected_pipeline",
      "Projected pipeline",
      "Latest base projections; not earned revenue.",
      input.profits.projectedCents.toString(),
      input.profits.projectedCents.toString(),
      null,
      "cents",
      input.transactions.length,
    ),
    metric(
      "weighted_pipeline",
      "Probability-weighted pipeline",
      "Latest probability-weighted projections; not earned revenue.",
      input.profits.weightedCents.toString(),
      input.profits.weightedCents.toString(),
      null,
      "cents",
      input.transactions.length,
    ),
    metric(
      "contracted_pipeline",
      "Contracted pipeline",
      "Contract-supported pipeline; not realized profit.",
      input.profits.contractedCents.toString(),
      input.profits.contractedCents.toString(),
      null,
      "cents",
      input.transactions.length,
    ),
    metric(
      "realized_profit",
      "Realized profit",
      "Settlement-reviewed realized company profit.",
      input.profits.realizedCents.toString(),
      input.profits.realizedCents.toString(),
      null,
      "cents",
      input.profits.realizedValues.length,
    ),
    metric(
      "average_closed_profit",
      "Average closed profit",
      "Mean settlement-reviewed realized profit.",
      input.profits.realizedValues.length
        ? (
            input.profits.realizedCents /
            BigInt(input.profits.realizedValues.length)
          ).toString()
        : null,
      input.profits.realizedCents.toString(),
      input.profits.realizedValues.length,
      "cents",
      input.profits.realizedValues.length,
    ),
    metric(
      "buyer_closing_rate",
      "Buyer closing rate",
      "Verified completed closings divided by completed plus failed closings.",
      buyerCompleted + buyerFailed
        ? Math.round((buyerCompleted / (buyerCompleted + buyerFailed)) * 1000) /
            10
        : null,
      buyerCompleted,
      buyerCompleted + buyerFailed,
      "percent",
      buyerCompleted + buyerFailed,
    ),
    metric(
      "buyer_retrade_rate",
      "Buyer retrade rate",
      "Verified retrades divided by measured responses.",
      buyerResponses
        ? Math.round((buyerRetrades / buyerResponses) * 1000) / 10
        : null,
      buyerRetrades,
      buyerResponses,
      "percent",
      buyerResponses,
    ),
    metric(
      "evidence_freshness",
      "Evidence freshness",
      "Verified findings observed within seven days.",
      input.evidence.length
        ? Math.round((fresh / input.evidence.length) * 1000) / 10
        : null,
      fresh,
      input.evidence.length,
      "percent",
      input.evidence.length,
    ),
    metric(
      "manual_verification_backlog",
      "Manual-verification backlog",
      "Findings not currently verified.",
      input.evidence.length - fresh,
      input.evidence.length - fresh,
      input.evidence.length,
      "count",
      input.evidence.length,
    ),
    metric(
      "owner_approval_queue_age",
      "Owner approval queue age",
      "Average hours pending owner decision.",
      average(approvalAges),
      pendingApprovals.length,
      null,
      "hours",
      pendingApprovals.length,
    ),
    metric(
      "agent_queue_failures",
      "Agent queue failures",
      "Agent tasks in FAILED status.",
      failedTasks.length,
      failedTasks.length,
      input.agentTasks.length,
      "count",
      input.agentTasks.length,
    ),
    metric(
      "agent_retry_count",
      "Agent retry count",
      "Total attempts beyond each task's initial run.",
      input.agentTasks.reduce((s, t) => s + Math.max(0, t.attemptCount - 1), 0),
      null,
      input.agentTasks.length,
      "count",
      input.agentTasks.length,
    ),
  ];
  return {
    metrics,
    falloutReasons: Object.fromEntries(
      [...new Set(input.outcomes.map((o) => o.reason || "UNSPECIFIED"))].map(
        (reason) => [
          reason,
          input.outcomes.filter((o) => (o.reason || "UNSPECIFIED") === reason)
            .length,
        ],
      ),
    ),
    generatedAt: lastRefresh,
  };
}
