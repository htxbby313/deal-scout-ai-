import "server-only";

import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { buildOperationalKpis } from "@/lib/operational-kpis";
import {
  buildActivityCompleteness,
  buildProfitSegments,
  buildTimingKpis,
} from "@/lib/operational-kpi-extensions";
import { outcomeReasonCoverage } from "@/lib/outcome-reasons";
import { buildSegmentedForecastErrors } from "@/lib/model-validation";

export type OperationalReportFilters = {
  start?: string;
  end?: string;
  state?: string;
  county?: string;
  zip?: string;
  stage?: string;
  buyerId?: string;
  agentId?: string;
  propertyType?: string;
  leadSource?: string;
  transactionStructure?: string;
};

function validDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function readOperationalReport(
  filters: OperationalReportFilters = {},
  now = new Date(),
) {
  const db = getPrisma();
  const windowStart = validDate(
    filters.start,
    new Date(now.getTime() - 30 * 86_400_000),
  );
  const windowEnd = validDate(filters.end, now);
  const propertyWhere: Prisma.PropertyWhereInput = {
    createdAt: { gte: windowStart, lte: windowEnd },
    ...(filters.state
      ? { state: { equals: filters.state, mode: "insensitive" } }
      : {}),
    ...(filters.county
      ? { county: { equals: filters.county, mode: "insensitive" } }
      : {}),
    ...(filters.zip ? { zipCode: filters.zip } : {}),
    ...(filters.propertyType
      ? { propertyType: { equals: filters.propertyType, mode: "insensitive" } }
      : {}),
    ...(filters.leadSource
      ? { leadSource: { equals: filters.leadSource, mode: "insensitive" } }
      : {}),
  };
  const funnelWhere: Prisma.AcquisitionFunnelWhereInput = {
    property: propertyWhere,
    ...(filters.stage
      ? { stage: filters.stage as Prisma.EnumAcquisitionStageFilter["equals"] }
      : {}),
    ...(filters.buyerId
      ? {
          buyerCoverage: {
            some: { demandVersion: { developerId: filters.buyerId } },
          },
        }
      : {}),
    ...(filters.agentId
      ? {
          transaction: {
            is: { agentTasks: { some: { assignedAgentId: filters.agentId } } },
          },
        }
      : {}),
  };
  const transactionWhere: Prisma.DealTransactionWhereInput = {
    property: propertyWhere,
    ...(filters.stage
      ? {
          acquisitionFunnel: {
            is: {
              stage:
                filters.stage as Prisma.EnumAcquisitionStageFilter["equals"],
            },
          },
        }
      : {}),
    ...(filters.buyerId ? { developerId: filters.buyerId } : {}),
    ...(filters.agentId
      ? { agentTasks: { some: { assignedAgentId: filters.agentId } } }
      : {}),
    ...(filters.transactionStructure
      ? {
          transactionStructure: {
            equals: filters.transactionStructure,
            mode: "insensitive",
          },
        }
      : {}),
  };

  const [
    properties,
    funnels,
    engagements,
    transactions,
    outcomes,
    buyerEvidence,
    costs,
    projections,
    scores,
    settlements,
    evidence,
    approvals,
    agentTasks,
    buyerPrices,
    dispositionPackages,
  ] = await Promise.all([
    db.property.findMany({
      where: propertyWhere,
      select: {
        createdAt: true,
        researchRuns: { select: { status: true } },
        researchFindings: { select: { status: true } },
      },
    }),
    db.acquisitionFunnel.findMany({
      where: funnelWhere,
      select: {
        id: true,
        createdAt: true,
        stage: true,
        stageEnteredAt: true,
        stageHistory: {
          select: {
            fromStage: true,
            toStage: true,
            occurredAt: true,
            exitedAt: true,
          },
        },
      },
    }),
    db.sellerEngagement.findMany({
      where: { transaction: transactionWhere },
      select: {
        createdAt: true,
        ownerApprovedAt: true,
        contactAttempts: {
          where: { createdAt: { gte: windowStart, lte: windowEnd } },
          select: { status: true, attemptedAt: true },
        },
        conversations: {
          where: { occurredAt: { gte: windowStart, lte: windowEnd } },
          select: { occurredAt: true },
        },
        offerHistory: {
          where: { createdAt: { gte: windowStart, lte: windowEnd } },
          select: { status: true, createdAt: true, deliveredAt: true },
        },
      },
    }),
    db.dealTransaction.findMany({
      where: transactionWhere,
      select: {
        id: true,
        createdAt: true,
        status: true,
        controlStatus: true,
        transactionStructure: true,
        property: {
          select: {
            city: true,
            state: true,
            zipCode: true,
            county: true,
            propertyType: true,
            leadSource: true,
          },
        },
        developer: { select: { companyName: true } },
      },
    }),
    db.transactionOutcome.findMany({
      where: { transaction: transactionWhere },
      select: {
        id: true,
        transactionId: true,
        version: true,
        createdAt: true,
        status: true,
        cancellationReason: true,
        reasonCode: true,
        assignmentFee: true,
        predictedProbabilityBps: true,
        projection: { select: { feeBaseCents: true } },
      },
    }),
    db.buyerReliabilityEvidence.findMany({
      where: {
        status: "VERIFIED",
        ...(filters.buyerId ? { developerId: filters.buyerId } : {}),
      },
      select: {
        completedClosings: true,
        failedClosings: true,
        retrades: true,
        responsesMeasured: true,
      },
    }),
    db.campaignCostEntry.findMany({
      where: { incurredAt: { gte: windowStart, lte: windowEnd } },
      select: { type: true, amountCents: true, funnelId: true },
    }),
    db.financialProjection.findMany({
      where: { transaction: transactionWhere },
      orderBy: { version: "desc" },
      select: {
        transactionId: true,
        version: true,
        feeBaseCents: true,
        probabilityWeightedCents: true,
      },
    }),
    db.profitPriorityScoreHistory.findMany({
      where: { funnel: funnelWhere },
      orderBy: { version: "desc" },
      select: { funnelId: true, version: true, contractedFeeCents: true },
    }),
    db.settlementReview.findMany({
      where: { transaction: transactionWhere },
      orderBy: { version: "desc" },
      select: { transactionId: true, version: true, realizedProfitCents: true },
    }),
    db.propertyResearchFinding.findMany({
      where: { property: propertyWhere },
      select: { status: true, observedAt: true },
    }),
    db.transactionApproval.findMany({
      where: { transaction: transactionWhere },
      select: { status: true, requestedAt: true },
    }),
    db.agentTask.findMany({
      where: {
        createdAt: { gte: windowStart, lte: windowEnd },
        ...(filters.agentId ? { assignedAgentId: filters.agentId } : {}),
      },
      select: { status: true, attemptCount: true, createdAt: true },
    }),
    db.buyerPropertyPriceEvidence.findMany({
      where: { funnel: funnelWhere },
      select: { status: true },
    }),
    db.transactionDocument.findMany({
      where: {
        transaction: transactionWhere,
        type: { contains: "DISPOSITION", mode: "insensitive" },
      },
      select: { status: true, counselApproved: true },
    }),
  ]);

  const latest = <T extends { version: number }>(
    rows: T[],
    key: (row: T) => string,
  ) => [
    ...rows
      .reduce((map, row) => {
        const current = map.get(key(row));
        if (!current || row.version > current.version) map.set(key(row), row);
        return map;
      }, new Map<string, T>())
      .values(),
  ];
  const latestProjections = latest(projections, (row) => row.transactionId);
  const latestScores = latest(scores, (row) => row.funnelId);
  const latestSettlements = latest(settlements, (row) => row.transactionId);
  const latestOutcomes = latest(outcomes, (row) => row.transactionId);
  const sum = (values: bigint[]) =>
    values.reduce((total, value) => total + value, BigInt(0));

  const funnelIds = new Set(funnels.map((item) => item.id));
  const segmented = Boolean(
    filters.state ||
      filters.county ||
      filters.zip ||
      filters.stage ||
      filters.buyerId ||
      filters.agentId ||
      filters.propertyType ||
      filters.leadSource ||
      filters.transactionStructure,
  );
  const scopedCosts = segmented
    ? costs.filter((item) => item.funnelId && funnelIds.has(item.funnelId))
    : costs;
  const report = buildOperationalKpis({
    properties: properties.map((item) => ({
      createdAt: item.createdAt,
      researched: item.researchRuns.some((run) => run.status === "COMPLETED"),
      researchException: item.researchFindings.some(
        (finding) => finding.status !== "VERIFIED",
      ),
    })),
    funnels,
    engagements: engagements.map((item) => ({
      createdAt: item.createdAt,
      ownerApproved: Boolean(item.ownerApprovedAt),
      attempts: item.contactAttempts,
      conversations: item.conversations,
      offers: item.offerHistory,
    })),
    transactions,
    outcomes: outcomes.map((item) => ({
      createdAt: item.createdAt,
      closed:
        item.status === "CLOSED_ASSIGNED" || item.status === "CLOSED_PURCHASED",
      reason: item.reasonCode ?? item.cancellationReason,
    })),
    buyerEvidence,
    costs: scopedCosts,
    profits: {
      projectedCents: sum(latestProjections.map((item) => item.feeBaseCents)),
      weightedCents: sum(
        latestProjections.map((item) => item.probabilityWeightedCents),
      ),
      contractedCents: sum(
        latestScores.flatMap((item) =>
          item.contractedFeeCents == null ? [] : [item.contractedFeeCents],
        ),
      ),
      realizedCents: sum(
        latestSettlements.map((item) => item.realizedProfitCents),
      ),
      realizedValues: latestSettlements.map((item) => item.realizedProfitCents),
    },
    evidence,
    approvals,
    agentTasks,
    windowStart,
    windowEnd,
    refreshedAt: now,
  });
  const timings = buildTimingKpis(funnels);
  const activity = buildActivityCompleteness({
    funnels,
    transactions,
    outcomes: outcomes.map((item) => ({
      closed: ["CLOSED_ASSIGNED", "CLOSED_PURCHASED"].includes(item.status),
      reason: item.reasonCode,
    })),
    buyerPrices,
    dispositionPackages: dispositionPackages.map((item) => ({
      approved:
        item.counselApproved && ["APPROVED", "EXECUTED"].includes(item.status),
    })),
  });
  const reasonCoverage = outcomeReasonCoverage(outcomes);
  const extra = (
    key: string,
    label: string,
    definition: string,
    value: number | string | null,
    numerator: number | string | null,
    denominator: number | string | null,
    unit: "count" | "percent" | "hours" | "cents",
    sampleSize: number,
  ) => ({
    key,
    label,
    definition,
    value,
    numerator,
    denominator,
    unit,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    lastRefresh: now.toISOString(),
    sampleSize,
    ...(sampleSize > 0 && sampleSize < 30
      ? { warning: "Small sample; interpret cautiously." }
      : {}),
  });
  const sellerReached = engagements.filter(
      (item) => item.conversations.length > 0,
    ).length,
    qualifiedConversations = engagements.reduce(
      (sum, item) => sum + item.conversations.length,
      0,
    ),
    contracts = transactions.filter((item) =>
      [
        "UNDER_CONTRACT",
        "BUYER_MATCHING",
        "ASSIGNMENT_PENDING",
        "CLOSING_PENDING",
        "COMPLETED",
      ].includes(item.status),
    ).length;
  const totalCost = scopedCosts.reduce(
    (sum, item) => sum + item.amountCents,
    BigInt(0),
  );
  const per = (count: number) =>
    count ? (totalCost / BigInt(count)).toString() : null;
  const realizedSorted = latestSettlements
    .map((item) => item.realizedProfitCents)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const middle = Math.floor(realizedSorted.length / 2);
  const medianProfit = !realizedSorted.length
    ? null
    : (realizedSorted.length % 2
        ? realizedSorted[middle]
        : (realizedSorted[middle - 1] + realizedSorted[middle]) / BigInt(2)
      ).toString();
  report.metrics.push(
    extra(
      "buyer_prices_requested",
      "Buyer prices requested",
      "Property-specific buyer price records created.",
      activity.buyerPricesRequested,
      activity.buyerPricesRequested,
      null,
      "count",
      activity.buyerPricesRequested,
    ),
    extra(
      "buyer_prices_received",
      "Buyer prices received",
      "Documented or committed property-specific buyer prices.",
      activity.buyerPricesReceived,
      activity.buyerPricesReceived,
      activity.buyerPricesRequested,
      "count",
      activity.buyerPricesRequested,
    ),
    extra(
      "disposition_packages_approved",
      "Disposition packages approved",
      "Executed, counsel-approved disposition document packages.",
      activity.dispositionPackagesApproved,
      activity.dispositionPackagesApproved,
      null,
      "count",
      activity.dispositionPackagesApproved,
    ),
    ...(
      [
        "dealsLost",
        "dealsBlocked",
        "dealsStopped",
        "dealsArchived",
        "dealsNurtured",
      ] as const
    ).map((key) =>
      extra(
        key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
        key
          .replace(/[A-Z]/g, (letter) => ` ${letter}`)
          .replace(/^./, (letter) => letter.toUpperCase()),
        "Explicit terminal or controlled opportunity count.",
        activity[key],
        activity[key],
        null,
        "count",
        activity[key],
      ),
    ),
    extra(
      "discovery_to_contract_hours",
      "Discovery-to-contract time",
      "Average hours from funnel creation to CONTRACTED.",
      timings.discovery_to_contract.average,
      null,
      null,
      "hours",
      timings.discovery_to_contract.sampleSize,
    ),
    extra(
      "contract_to_close_hours",
      "Contract-to-close time",
      "Average hours from CONTRACTED to CLOSED.",
      timings.contract_to_close.average,
      null,
      null,
      "hours",
      timings.contract_to_close.sampleSize,
    ),
    extra(
      "outcome_reason_coverage",
      "Outcome reason coverage",
      "Final outcomes with a structured reason code.",
      reasonCoverage.percent,
      reasonCoverage.covered,
      reasonCoverage.total,
      "percent",
      reasonCoverage.total,
    ),
    extra(
      "cost_per_qualified_conversation",
      "Cost per qualified conversation",
      "Attributed costs divided by source-linked seller conversations.",
      per(qualifiedConversations),
      totalCost.toString(),
      qualifiedConversations,
      "cents",
      qualifiedConversations,
    ),
    extra(
      "cost_per_contract",
      "Cost per contract",
      "Attributed costs divided by signed contracts.",
      per(contracts),
      totalCost.toString(),
      contracts,
      "cents",
      contracts,
    ),
    extra(
      "median_closed_profit",
      "Median closed profit",
      "Median settlement-reviewed realized company profit.",
      medianProfit,
      realizedSorted.length ? medianProfit : null,
      realizedSorted.length,
      "cents",
      realizedSorted.length,
    ),
    extra(
      "seller_response_rate",
      "Seller response rate",
      "Seller engagements with a sourced conversation divided by contact attempts.",
      engagements.reduce((sum, item) => sum + item.contactAttempts.length, 0)
        ? Math.round(
            (sellerReached /
              engagements.reduce(
                (sum, item) => sum + item.contactAttempts.length,
                0,
              )) *
              1000,
          ) / 10
        : null,
      sellerReached,
      engagements.reduce((sum, item) => sum + item.contactAttempts.length, 0),
      "percent",
      engagements.reduce((sum, item) => sum + item.contactAttempts.length, 0),
    ),
    extra(
      "seller_contract_conversion_rate",
      "Seller-to-contract conversion",
      "Signed contracts divided by seller engagements reached.",
      sellerReached
        ? Math.round((contracts / sellerReached) * 1000) / 10
        : null,
      contracts,
      sellerReached,
      "percent",
      sellerReached,
    ),
  );
  const projectionByTransaction = new Map(
    latestProjections.map((item) => [item.transactionId, item.feeBaseCents]),
  );
  const settlementByTransaction = new Map(
    latestSettlements.map((item) => [
      item.transactionId,
      item.realizedProfitCents,
    ]),
  );
  const transactionById = new Map(transactions.map((item) => [item.id, item]));
  const forecastErrors = buildSegmentedForecastErrors(
    latestOutcomes.map((outcome) => {
      const transaction = transactionById.get(outcome.transactionId);
      return {
        status: outcome.status,
        assignmentFee: outcome.assignmentFee,
        predictedAssignmentFee: outcome.projection
          ? Number(outcome.projection.feeBaseCents)
          : null,
        predictedProbabilityBps: outcome.predictedProbabilityBps,
        market: transaction
          ? `${transaction.property.city}, ${transaction.property.state}`
          : null,
        assetType: transaction?.property.propertyType,
        buyer: transaction?.developer?.companyName,
        strategy: transaction?.transactionStructure,
        leadSource: transaction?.property.leadSource,
      };
    }),
  );
  return {
    ...report,
    timings,
    activity,
    forecastErrors,
    profitSegments: buildProfitSegments(
      transactions.map((item) => ({
        market: `${item.property.city}, ${item.property.state}`,
        zip: item.property.zipCode,
        county: item.property.county,
        propertyType: item.property.propertyType,
        leadSource: item.property.leadSource,
        strategy: item.transactionStructure,
        buyer: item.developer?.companyName,
        projectedCents: projectionByTransaction.get(item.id),
        realizedCents: settlementByTransaction.get(item.id),
      })),
    ),
  };
}
