import "server-only";

import type {
  Prisma,
  DealTransactionStatus,
  TransactionControlStatus,
} from "@prisma/client";

import { latestAcquisitionGates } from "@/lib/acquisition-gate-versioning";
import {
  assembleDealUnitCost,
  ENFORMION_LOOKUP_RESERVED_TYPE,
  ENFORMION_RESERVATION_SCAN_CAP,
  type DealUnitCost,
} from "@/lib/deal-unit-cost";
import { getPrisma } from "@/lib/prisma";

/**
 * Deal is a service-layer aggregate, not a Prisma model.
 *
 * Canonical DealTransaction on a property:
 * 1. Prefer the newest transaction whose controlStatus is not STOPPED.
 * 2. If every transaction is STOPPED, use the newest STOPPED row.
 * Newest means createdAt descending.
 *
 * A property with no DealTransaction is a valid Deal (transaction is null).
 */
export const TERMINAL_DEAL_TRANSACTION_STATUSES = [
  "COMPLETED",
  "CANCELLED",
] as const satisfies readonly DealTransactionStatus[];

export const ACTIVE_DEAL_TRANSACTION_EXISTS_MESSAGE =
  "A second DealTransaction cannot be created while this property has a non-stopped, non-terminal transaction. Stop or complete the existing transaction first.";

const dealPropertyInclude = {
  researchFindings: { orderBy: { observedAt: "desc" as const } },
  comparableSales: true,
  discoveryReferences: { orderBy: { submittedAt: "desc" as const } },
  media: true,
  acquisitionFunnels: { orderBy: { updatedAt: "desc" as const }, take: 1 },
  matches: {
    include: {
      developer: {
        include: {
          projects: {
            where: {
              verifiedAt: { not: null },
              sourceUrl: { not: null },
            },
            orderBy: { verifiedAt: "desc" as const },
            take: 10,
          },
        },
      },
    },
    orderBy: { score: "desc" as const },
    take: 5,
  },
  transactions: {
    orderBy: { createdAt: "desc" as const },
    include: {
      documents: true,
      approvals: true,
      sellerEngagements: {
        orderBy: { updatedAt: "desc" as const },
        include: {
          conversations: { orderBy: { occurredAt: "desc" as const }, take: 8 },
          followUps: true,
          consents: { orderBy: { createdAt: "desc" as const }, take: 1 },
          offerHistory: { orderBy: { createdAt: "desc" as const }, take: 1 },
          _count: { select: { conversations: true, sellerFacts: true } },
        },
      },
      financialProjections: { orderBy: { version: "desc" as const }, take: 1 },
      outcomes: { orderBy: { version: "desc" as const }, take: 1 },
      acquisitionFunnel: {
        include: {
          gates: true,
          blockers: { where: { status: "OPEN" as const } },
          priorityScores: { orderBy: { version: "desc" as const }, take: 1 },
        },
      },
    },
  },
} satisfies Prisma.PropertyInclude;

type LoadedProperty = Prisma.PropertyGetPayload<{
  include: typeof dealPropertyInclude;
}>;
type LoadedTransaction = LoadedProperty["transactions"][number];
type LoadedFunnel = NonNullable<LoadedTransaction["acquisitionFunnel"]>;
type LoadedPriorityScore = LoadedFunnel["priorityScores"][number];

export type DealAggregate = {
  property: Omit<LoadedProperty, "transactions">;
  transaction: LoadedTransaction | null;
  funnel: LoadedFunnel | null;
  priorityScore: LoadedPriorityScore | null;
  gates: LoadedFunnel["gates"];
  blockers: LoadedFunnel["blockers"];
  projection: LoadedTransaction["financialProjections"][number] | null;
  outcome: LoadedTransaction["outcomes"][number] | null;
  unitCost: DealUnitCost;
  comps: LoadedProperty["comparableSales"];
  matches: LoadedProperty["matches"];
  researchFindings: LoadedProperty["researchFindings"];
  discoveryReferences: LoadedProperty["discoveryReferences"];
  sellerEngagements: LoadedTransaction["sellerEngagements"];
  media: LoadedProperty["media"];
};

export function isTerminalDealTransactionStatus(status: DealTransactionStatus) {
  return (TERMINAL_DEAL_TRANSACTION_STATUSES as readonly string[]).includes(
    status,
  );
}

export function isClosedDealTransaction(transaction: {
  controlStatus: TransactionControlStatus;
  status: DealTransactionStatus;
}) {
  return (
    transaction.controlStatus === "STOPPED" ||
    isTerminalDealTransactionStatus(transaction.status)
  );
}

export function selectCanonicalTransaction<
  T extends { createdAt: Date; controlStatus: TransactionControlStatus },
>(transactions: readonly T[]): T | null {
  if (!transactions.length) return null;
  const newestFirst = [...transactions].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
  return (
    newestFirst.find((transaction) => transaction.controlStatus !== "STOPPED") ??
    newestFirst[0]
  );
}

export function assertCanCreateDealTransaction(
  existing: ReadonlyArray<{
    controlStatus: TransactionControlStatus;
    status: DealTransactionStatus;
  }>,
) {
  if (existing.some((transaction) => !isClosedDealTransaction(transaction))) {
    throw new Error(ACTIVE_DEAL_TRANSACTION_EXISTS_MESSAGE);
  }
}

export async function getDeal(propertyId: string): Promise<DealAggregate | null> {
  const db = getPrisma();
  const record = await db.property.findUnique({
    where: { id: propertyId },
    include: dealPropertyInclude,
  });
  if (!record) return null;

  const [taskCost, reservationRows] = await Promise.all([
    db.agentTask.aggregate({
      where: { propertyId },
      _sum: { estimatedCostCents: true },
    }),
    db.auditLog.findMany({
      where: { type: ENFORMION_LOOKUP_RESERVED_TYPE },
      select: { details: true },
      orderBy: { createdAt: "desc" },
      take: ENFORMION_RESERVATION_SCAN_CAP,
    }),
  ]);

  const { transactions, ...property } = record;
  const transaction = selectCanonicalTransaction(transactions);
  const funnel = transaction?.acquisitionFunnel ?? null;
  const gates = funnel ? latestAcquisitionGates(funnel.gates) : [];
  const blockers = funnel?.blockers ?? [];
  const projection = transaction?.financialProjections[0] ?? null;
  const outcome = transaction?.outcomes[0] ?? null;
  const sellerEngagements = transaction?.sellerEngagements ?? [];
  const priorityScore = funnel?.priorityScores[0] ?? null;
  const unitCost = assembleDealUnitCost({
    agentTaskCostCents: taskCost._sum.estimatedCostCents,
    reservationRows,
    propertyId,
  });

  return {
    property,
    transaction,
    funnel,
    priorityScore,
    gates,
    blockers,
    projection,
    outcome,
    unitCost,
    comps: property.comparableSales,
    matches: property.matches,
    researchFindings: property.researchFindings,
    discoveryReferences: property.discoveryReferences,
    sellerEngagements,
    media: property.media,
  };
}
