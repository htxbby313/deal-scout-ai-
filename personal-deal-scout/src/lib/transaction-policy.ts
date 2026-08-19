import type {
  DealTransactionStatus,
  TransactionApprovalStatus,
  TransactionApprovalType,
  TransactionControlStatus,
} from "@prisma/client";

export type TransactionGateInput = {
  controlStatus: TransactionControlStatus;
  nextStatus: DealTransactionStatus;
  counselApprovedAt?: Date | null;
  complianceVerifiedAt?: Date | null;
  approvals: Array<{
    type: TransactionApprovalType;
    status: TransactionApprovalStatus;
    expiresAt?: Date | null;
  }>;
  now?: Date;
};

const requiredApprovalByStatus: Partial<Record<DealTransactionStatus, TransactionApprovalType[]>> = {
  OFFER_PENDING: ["OFFER"],
  UNDER_CONTRACT: ["CONTRACT"],
  BUYER_MATCHING: ["BUYER_CONTACT"],
  ASSIGNMENT_PENDING: ["ASSIGNMENT_MARKETING", "ASSIGNMENT"],
  CLOSING_PENDING: ["CLOSING_INSTRUCTION"],
};

const counselGatedStatuses = new Set<DealTransactionStatus>([
  "OFFER_PENDING",
  "UNDER_CONTRACT",
  "BUYER_MATCHING",
  "ASSIGNMENT_PENDING",
  "CLOSING_PENDING",
  "COMPLETED",
]);

export function evaluateTransactionGate(input: TransactionGateInput) {
  const reasons: string[] = [];
  const now = input.now ?? new Date();

  if (input.controlStatus !== "ACTIVE") reasons.push(`Transaction control is ${input.controlStatus}.`);
  if (input.nextStatus === "COMPLETED") reasons.push("Completion must be recorded through the verified closing workflow.");
  if (counselGatedStatuses.has(input.nextStatus) && !input.counselApprovedAt) reasons.push("Counsel approval is not recorded.");
  if (counselGatedStatuses.has(input.nextStatus) && !input.complianceVerifiedAt) reasons.push("Compliance verification is not recorded.");

  for (const type of requiredApprovalByStatus[input.nextStatus] ?? []) {
    const approved = input.approvals.some((approval) =>
      approval.type === type
      && approval.status === "APPROVED"
      && (!approval.expiresAt || approval.expiresAt > now));
    if (!approved) reasons.push(`${type} owner approval is required.`);
  }

  return { allowed: reasons.length === 0, reasons };
}

