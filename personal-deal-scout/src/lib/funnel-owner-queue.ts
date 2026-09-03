import "server-only";
import { BUY_BOX_BLOCKER_CODE } from "@/lib/buy-box";
import { getPrisma } from "@/lib/prisma";

export type OwnerQueueItem = {
  id: string;
  kind:
    | "AGENT_TASK"
    | "TRANSACTION_APPROVAL"
    | "FUNNEL_BLOCKER"
    | "SELLER_ENGAGEMENT"
    | "DEVELOPER_DRAFT"
    | "CONTRACT_TEMPLATE";
  label: string;
  detail?: string;
  createdAt: Date;
  urgent: boolean;
  href: string;
};

export function sortOwnerQueue(items: OwnerQueueItem[]) {
  return [...items].sort(
    (a, b) =>
      Number(b.urgent) - Number(a.urgent) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

export async function readFunnelOwnerQueue() {
  const db = getPrisma();
  const [
    agentTasks,
    approvals,
    blockers,
    engagements,
    developerDrafts,
    templates,
  ] = await Promise.all([
    db.agentTask.findMany({
      where: { status: "WAITING_FOR_APPROVAL", ownerApprovalRequired: true },
      include: {
        assignedAgent: true,
        transaction: { include: { property: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 100,
    }),
    db.transactionApproval.findMany({
      where: { status: "PENDING" },
      include: { transaction: { include: { property: true } } },
      orderBy: { requestedAt: "asc" },
      take: 100,
    }),
    db.acquisitionFunnelBlocker.findMany({
      where: { status: "OPEN" },
      include: { funnel: { include: { property: true } } },
      orderBy: { openedAt: "asc" },
      take: 100,
    }),
    db.sellerEngagement.findMany({
      where: { status: "READY_FOR_OWNER_REVIEW" },
      include: { transaction: { include: { property: true } } },
      orderBy: { updatedAt: "asc" },
      take: 100,
    }),
    db.messageApproval.findMany({
      where: {
        status: "PENDING",
        OR: [
          { subject: { startsWith: "Acquisitions relationship:" } },
          {
            subject: { startsWith: "Pricing request:" },
            leadId: { not: null },
          },
        ],
      },
      orderBy: { updatedAt: "asc" },
      take: 100,
    }),
    db.contractTemplateVersion.findMany({
      where: { status: "REVIEW_PENDING" },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
  ]);
  return sortOwnerQueue([
    ...agentTasks.map((item) => ({
      id: item.id,
      kind: "AGENT_TASK" as const,
      label: item.title,
      detail: `${item.assignedAgent.name}${item.transaction?.property.address ? ` · ${item.transaction.property.address}` : ""} · ${item.evidenceCount} evidence item${item.evidenceCount === 1 ? "" : "s"}`,
      createdAt: item.updatedAt,
      urgent: item.priority === "URGENT",
      href: `/agents#task-${item.id}`,
    })),
    ...approvals.map((item) => ({
      id: item.id,
      kind: "TRANSACTION_APPROVAL" as const,
      label: `${item.type} · ${item.transaction.property.address}`,
      createdAt: item.requestedAt,
      urgent: item.expiresAt
        ? item.expiresAt.getTime() - Date.now() < 24 * 60 * 60_000
        : false,
      href: `/transactions?id=${item.transactionId}`,
    })),
    ...blockers.map((item) => ({
      id: item.id,
      kind: "FUNNEL_BLOCKER" as const,
      label:
        item.code === BUY_BOX_BLOCKER_CODE
          ? `Buy Box match · ${item.funnel.property.address}`
          : `${item.code} · ${item.funnel.property.address}`,
      createdAt: item.openedAt,
      urgent: item.expiresAt
        ? item.expiresAt.getTime() - Date.now() < 24 * 60 * 60_000
        : false,
      href: `/deals/${item.funnel.propertyId}`,
    })),
    ...engagements.map((item) => ({
      id: item.id,
      kind: "SELLER_ENGAGEMENT" as const,
      label: `${item.channel} · ${item.transaction.property.address}`,
      createdAt: item.createdAt,
      urgent: false,
      href: `/seller-crm?engagementId=${item.id}`,
    })),
    ...developerDrafts.map((item) => ({
      id: item.id,
      kind: "DEVELOPER_DRAFT" as const,
      label: item.subject ?? `Developer conversation · ${item.recipientLabel}`,
      detail: `${item.subject?.startsWith("Acquisitions relationship:") ? "Relationship introduction" : "Contract-cleared opportunity"} for ${item.recipientLabel}; no message has been sent.`,
      createdAt: item.createdAt,
      urgent: false,
      href: "/seller-crm#developer-drafts",
    })),
    ...templates.map((item) => ({
      id: item.id,
      kind: "CONTRACT_TEMPLATE" as const,
      label: `${item.type} · ${item.jurisdictionState} · v${item.version}`,
      createdAt: item.createdAt,
      urgent: false,
      href: "/contracts",
    })),
  ]);
}

export async function readOwnerAgentActivity() {
  const events = await getPrisma().agentEvent.findMany({
    include: { actorAgent: true, task: { include: { assignedAgent: true } } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return events.map((event) => ({
    id: event.id,
    agentName: event.actorAgent?.name ?? event.task.assignedAgent.name,
    summary: event.summary,
    createdAt: event.createdAt,
  }));
}
