import "server-only";
import { getPrisma } from "@/lib/prisma";

export type OwnerQueueItem = { id: string; kind: "TRANSACTION_APPROVAL" | "FUNNEL_BLOCKER" | "SELLER_ENGAGEMENT" | "CONTRACT_TEMPLATE"; label: string; createdAt: Date; urgent: boolean; href: string };

export function sortOwnerQueue(items: OwnerQueueItem[]) {
  return [...items].sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.createdAt.getTime() - b.createdAt.getTime());
}

export async function readFunnelOwnerQueue() {
  const db = getPrisma();
  const [approvals, blockers, engagements, templates] = await Promise.all([
    db.transactionApproval.findMany({ where: { status: "PENDING" }, include: { transaction: { include: { property: true } } }, orderBy: { requestedAt: "asc" }, take: 100 }),
    db.acquisitionFunnelBlocker.findMany({ where: { status: "OPEN" }, include: { funnel: { include: { property: true } } }, orderBy: { openedAt: "asc" }, take: 100 }),
    db.sellerEngagement.findMany({ where: { status: "READY_FOR_OWNER_REVIEW" }, include: { transaction: { include: { property: true } } }, orderBy: { updatedAt: "asc" }, take: 100 }),
    db.contractTemplateVersion.findMany({ where: { status: "REVIEW_PENDING" }, orderBy: { createdAt: "asc" }, take: 100 }),
  ]);
  return sortOwnerQueue([
    ...approvals.map((item) => ({ id: item.id, kind: "TRANSACTION_APPROVAL" as const, label: `${item.type} · ${item.transaction.property.address}`, createdAt: item.requestedAt, urgent: item.expiresAt ? item.expiresAt.getTime() - Date.now() < 24 * 60 * 60_000 : false, href: `/transactions?id=${item.transactionId}` })),
    ...blockers.map((item) => ({ id: item.id, kind: "FUNNEL_BLOCKER" as const, label: `${item.code} · ${item.funnel.property.address}`, createdAt: item.openedAt, urgent: item.expiresAt ? item.expiresAt.getTime() - Date.now() < 24 * 60 * 60_000 : false, href: "/pipeline" })),
    ...engagements.map((item) => ({ id: item.id, kind: "SELLER_ENGAGEMENT" as const, label: `${item.channel} · ${item.transaction.property.address}`, createdAt: item.createdAt, urgent: false, href: "/seller-crm" })),
    ...templates.map((item) => ({ id: item.id, kind: "CONTRACT_TEMPLATE" as const, label: `${item.type} · ${item.jurisdictionState} · v${item.version}`, createdAt: item.createdAt, urgent: false, href: "/contracts" })),
  ]);
}
