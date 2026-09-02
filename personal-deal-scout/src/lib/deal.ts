import "server-only";

import type {
  Prisma,
  DealTransactionStatus,
  TransactionControlStatus,
} from "@prisma/client";

import { latestAcquisitionGates } from "@/lib/acquisition-gate-versioning";
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
    include: { developer: true },
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
          conversations: { orderBy: { occurredAt: "desc" as const }, take: 1 },
          followUps: true,
          consents: { orderBy: { createdAt: "desc" as const }, take: 1 },
          offerHistory: { orderBy: { createdAt: "desc" as const }, take: 1 },
          _count: { select: { conversations: true, sellerFacts: true } },
        },
      },
      financialProjections: { orderBy: { version: "desc" as const }, take: 1 },
      acquisitionFunnel: {
        include: {
          gates: true,
          blockers: { where: { status: "OPEN" as const } },
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

export type DealAggregate = {
  property: Omit<LoadedProperty, "transactions">;
  transaction: LoadedTransaction | null;
  funnel: LoadedFunnel | null;
  gates: LoadedFunnel["gates"];
  blockers: LoadedFunnel["blockers"];
  projection: LoadedTransaction["financialProjections"][number] | null;
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
  const record = await getPrisma().property.findUnique({
    where: { id: propertyId },
    include: dealPropertyInclude,
  });
  if (!record) return null;

  const { transactions, ...property } = record;
  const transaction = selectCanonicalTransaction(transactions);
  const funnel = transaction?.acquisitionFunnel ?? null;
  const gates = funnel ? latestAcquisitionGates(funnel.gates) : [];
  const blockers = funnel?.blockers ?? [];
  const projection = transaction?.financialProjections[0] ?? null;
  const sellerEngagements = transaction?.sellerEngagements ?? [];

  return {
    property,
    transaction,
    funnel,
    gates,
    blockers,
    projection,
    comps: property.comparableSales,
    matches: property.matches,
    researchFindings: property.researchFindings,
    discoveryReferences: property.discoveryReferences,
    sellerEngagements,
    media: property.media,
  };
}
