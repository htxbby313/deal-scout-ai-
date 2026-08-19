export type ContractTemplateActivationInput = {
  status: string;
  jurisdictionState: string;
  requestedJurisdictionState: string;
  artifactHash?: string | null;
  artifactLocated: boolean;
  userSuppliedBy?: string | null;
  userSuppliedAt?: Date | null;
  counselReviewer?: string | null;
  counselApprovedAt?: Date | null;
  counselApprovalEvidenceUrl?: string | null;
  ownerApprovedBy?: string | null;
  ownerApprovedAt?: Date | null;
  ownerApprovalReason?: string | null;
  effectiveAt?: Date | null;
  expiresAt?: Date | null;
  now?: Date;
};

export function evaluateContractTemplateActivation(input: ContractTemplateActivationInput) {
  const blockers: string[] = [];
  const now = input.now ?? new Date();
  if (input.status !== "REVIEW_PENDING") blockers.push("template_not_pending_review");
  if (input.jurisdictionState.toUpperCase() !== input.requestedJurisdictionState.toUpperCase()) blockers.push("jurisdiction_mismatch");
  if (!input.artifactHash || !/^[a-f0-9]{64}$/i.test(input.artifactHash) || !input.artifactLocated) blockers.push("user_artifact_missing");
  if (!input.userSuppliedBy || !input.userSuppliedAt) blockers.push("user_supply_record_missing");
  if (!input.counselReviewer || !input.counselApprovedAt || !input.counselApprovalEvidenceUrl) blockers.push("counsel_approval_missing");
  if (!input.ownerApprovedBy || !input.ownerApprovedAt || !input.ownerApprovalReason?.trim()) blockers.push("owner_approval_missing");
  if (!input.effectiveAt || input.effectiveAt > now) blockers.push("template_not_effective");
  if (!input.expiresAt || input.expiresAt <= now) blockers.push("template_expired_or_expiry_missing");
  return { allowed: blockers.length === 0, blockers };
}

export function contractTemplateCanBeUsed(input: { status: string; jurisdictionState: string; transactionState: string; activatedAt?: Date | null; effectiveAt?: Date | null; expiresAt?: Date | null; now?: Date }) {
  const now = input.now ?? new Date();
  return input.status === "ACTIVE"
    && input.jurisdictionState.toUpperCase() === input.transactionState.toUpperCase()
    && Boolean(input.activatedAt && input.effectiveAt && input.effectiveAt <= now && input.expiresAt && input.expiresAt > now);
}

