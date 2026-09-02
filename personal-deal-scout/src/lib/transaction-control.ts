import "server-only";

import {
  Prisma,
  type DealTransactionStatus,
  type TransactionApprovalType,
  type TransactionControlStatus,
} from "@prisma/client";

import { assertCanCreateDealTransaction } from "@/lib/deal";
import { getPrisma } from "@/lib/prisma";
import { evaluateTransactionGate } from "@/lib/transaction-policy";

type TransactionClient = Prisma.TransactionClient;

export async function appendAuditEvent(
  tx: TransactionClient,
  transactionId: string,
  type: string,
  actor: string,
  summary: string,
  details?: Prisma.InputJsonValue,
) {
  const latest = await tx.transactionAuditEvent.findFirst({
    where: { transactionId },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });
  return tx.transactionAuditEvent.create({
    data: { transactionId, sequence: (latest?.sequence ?? 0) + 1, type, actor, summary, details },
  });
}

export async function createControlledTransaction(input: {
  propertyId: string;
  leadId?: string;
  developerId?: string;
  actor: string;
  targetSellerPrice?: number;
  targetBuyerPrice?: number;
  targetAssignmentFee?: number;
}) {
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    const property = await tx.property.findUnique({ where: { id: input.propertyId }, select: { state: true } });
    if (!property) throw new Error("Property not found.");
    const existing = await tx.dealTransaction.findMany({
      where: { propertyId: input.propertyId },
      select: { controlStatus: true, status: true },
    });
    assertCanCreateDealTransaction(existing);
    const transaction = await tx.dealTransaction.create({
      data: {
        propertyId: input.propertyId,
        leadId: input.leadId,
        developerId: input.developerId,
        jurisdictionState: property.state,
        targetSellerPrice: input.targetSellerPrice,
        targetBuyerPrice: input.targetBuyerPrice,
        targetAssignmentFee: input.targetAssignmentFee,
        controlStatus: "ON_HOLD",
      },
    });
    const existingFunnel = await tx.acquisitionFunnel.findFirst({ where: { propertyId: input.propertyId, transactionId: null }, orderBy: { createdAt: "desc" } });
    if (existingFunnel) await tx.acquisitionFunnel.update({ where: { id: existingFunnel.id }, data: { transactionId: transaction.id } });
    else {
      const funnel = await tx.acquisitionFunnel.create({ data: { propertyId: input.propertyId, transactionId: transaction.id, stage: "DISCOVERED", expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
      await tx.acquisitionStageHistory.create({ data: { funnelId: funnel.id, sequence: 1, toStage: "DISCOVERED", actor: input.actor, reason: "Transaction created and attached to the acquisition funnel.", evidence: { transactionId: transaction.id } } });
    }
    await appendAuditEvent(tx, transaction.id, "transaction.created", input.actor,
      "Transaction created on owner hold; no contact, contract, payment, or closing action is authorized.");
    return transaction;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function setOwnerControl(input: {
  transactionId: string;
  controlStatus: TransactionControlStatus;
  actor: string;
  reason: string;
}) {
  if (!input.reason.trim()) throw new Error("A control reason is required.");
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    const current = await tx.dealTransaction.findUnique({ where: { id: input.transactionId } });
    if (!current) throw new Error("Transaction not found.");
    if (current.controlStatus === "STOPPED" && input.controlStatus !== "STOPPED") {
      throw new Error("A stopped transaction cannot be restarted; create a separately reviewed transaction.");
    }
    const stopped = input.controlStatus === "STOPPED";
    const transaction = await tx.dealTransaction.update({
      where: { id: input.transactionId },
      data: {
        controlStatus: input.controlStatus,
        ownerHoldReason: input.controlStatus === "ACTIVE" ? null : input.reason.trim(),
        ownerHoldAt: input.controlStatus === "ON_HOLD" ? new Date() : null,
        ownerStoppedAt: stopped ? new Date() : current.ownerStoppedAt,
        status: stopped ? "CANCELLED" : current.status,
      },
    });
    await appendAuditEvent(tx, transaction.id, `transaction.control.${input.controlStatus.toLowerCase()}`, input.actor,
      `Owner set transaction control to ${input.controlStatus}.`, { reason: input.reason.trim() });
    return transaction;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function requestTransactionApproval(input: {
  transactionId: string;
  type: TransactionApprovalType;
  actor: string;
  reason?: string;
  expiresAt?: Date;
}) {
  return getPrisma().$transaction(async (tx) => {
    const transaction = await tx.dealTransaction.findUnique({ where: { id: input.transactionId } });
    if (!transaction) throw new Error("Transaction not found.");
    if (transaction.controlStatus !== "ACTIVE") throw new Error("Approvals cannot be requested while a transaction is held or stopped.");
    const approval = await tx.transactionApproval.create({ data: {
      transactionId: input.transactionId,
      type: input.type,
      requestedBy: input.actor,
      reason: input.reason,
      expiresAt: input.expiresAt,
    } });
    await appendAuditEvent(tx, input.transactionId, "transaction.approval.requested", input.actor,
      `${input.type} approval requested.`, { approvalId: approval.id });
    return approval;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function registerTransactionDocument(input: {
  transactionId: string;
  type: string;
  title: string;
  actor: string;
  storageKey?: string;
  sourceUrl?: string;
  contentHash?: string;
}) {
  if (!input.type.trim() || !input.title.trim()) throw new Error("Document type and title are required.");
  if (!input.storageKey && !input.sourceUrl) throw new Error("A stored document or source URL is required.");
  if (input.sourceUrl && new URL(input.sourceUrl).protocol !== "https:") throw new Error("Document sources must use HTTPS.");
  return getPrisma().$transaction(async (tx) => {
    const transaction = await tx.dealTransaction.findUnique({ where: { id: input.transactionId } });
    if (!transaction) throw new Error("Transaction not found.");
    if (transaction.controlStatus === "STOPPED") throw new Error("Documents cannot be added to a stopped transaction.");
    const latest = await tx.transactionDocument.findFirst({
      where: { transactionId: input.transactionId, type: input.type.trim() },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const document = await tx.transactionDocument.create({ data: {
      transactionId: input.transactionId,
      type: input.type.trim(),
      title: input.title.trim(),
      version: (latest?.version ?? 0) + 1,
      storageKey: input.storageKey,
      sourceUrl: input.sourceUrl,
      contentHash: input.contentHash,
      status: "DRAFT",
      counselApproved: false,
    } });
    await appendAuditEvent(tx, input.transactionId, "transaction.document.registered", input.actor,
      `Registered ${document.type} document version ${document.version}.`, { documentId: document.id });
    return document;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function decideTransactionApproval(input: {
  approvalId: string;
  decision: "APPROVED" | "REJECTED" | "REVOKED";
  actor: string;
  reason: string;
}) {
  if (!input.reason.trim()) throw new Error("A decision reason is required.");
  return getPrisma().$transaction(async (tx) => {
    const current = await tx.transactionApproval.findUnique({ where: { id: input.approvalId }, include: { transaction: true } });
    if (!current) throw new Error("Approval not found.");
    if (current.transaction.controlStatus === "STOPPED") throw new Error("A stopped transaction cannot receive approvals.");
    const approval = await tx.transactionApproval.update({ where: { id: input.approvalId }, data: {
      status: input.decision,
      decidedBy: input.actor,
      decidedAt: new Date(),
      reason: input.reason.trim(),
    } });
    await appendAuditEvent(tx, approval.transactionId, `transaction.approval.${input.decision.toLowerCase()}`, input.actor,
      `${approval.type} approval ${input.decision.toLowerCase()}.`, { approvalId: approval.id, reason: input.reason.trim() });
    return approval;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function advanceTransaction(input: {
  transactionId: string;
  nextStatus: DealTransactionStatus;
  actor: string;
}) {
  return getPrisma().$transaction(async (tx) => {
    const transaction = await tx.dealTransaction.findUnique({
      where: { id: input.transactionId },
      include: { approvals: true },
    });
    if (!transaction) throw new Error("Transaction not found.");
    const gate = evaluateTransactionGate({
      controlStatus: transaction.controlStatus,
      nextStatus: input.nextStatus,
      counselApprovedAt: transaction.counselApprovedAt,
      complianceVerifiedAt: transaction.complianceVerifiedAt,
      approvals: transaction.approvals,
    });
    if (!gate.allowed) {
      await appendAuditEvent(tx, transaction.id, "transaction.progression.blocked", input.actor,
        `Blocked progression to ${input.nextStatus}.`, { reasons: gate.reasons });
      return { advanced: false as const, reasons: gate.reasons, transaction };
    }
    const updated = await tx.dealTransaction.update({ where: { id: transaction.id }, data: { status: input.nextStatus } });
    await appendAuditEvent(tx, transaction.id, "transaction.status.changed", input.actor,
      `Transaction advanced to ${input.nextStatus}.`);
    return { advanced: true as const, reasons: [], transaction: updated };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function readTransactionControl(transactionId: string) {
  return getPrisma().dealTransaction.findUnique({
    where: { id: transactionId },
    include: {
      property: true,
      lead: true,
      developer: true,
      documents: { orderBy: [{ type: "asc" }, { version: "desc" }] },
      approvals: { orderBy: { requestedAt: "desc" } },
      auditEvents: { orderBy: { sequence: "asc" } },
    },
  });
}

export async function readTransactionWorkspace() {
  const db = getPrisma();
  const [transactions, properties, developers] = await Promise.all([
    db.dealTransaction.findMany({
      include: { property: true, developer: true, documents: { orderBy: [{ type: "asc" }, { version: "desc" }] }, diligenceReviews: { include: { professionalArtifacts: { orderBy: { verifiedAt: "desc" } } }, orderBy: { level: "asc" } }, approvals: { orderBy: { requestedAt: "desc" } }, auditEvents: { orderBy: { sequence: "asc" } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.property.findMany({ where: { opportunityStatus: { not: "REJECTED" } }, select: { id: true, address: true, city: true, state: true, estimatedValue: true }, orderBy: { address: "asc" } }),
    db.developer.findMany({ where: { active: true }, select: { id: true, companyName: true }, orderBy: { companyName: "asc" } }),
  ]);
  return { transactions, properties, developers };
}
