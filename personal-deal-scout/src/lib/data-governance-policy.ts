export function evaluateRetentionPolicyActivation(input: { retentionDays: number; jurisdictionState: string; counselReviewer?: string | null; counselApprovedAt?: Date | null; counselEvidenceUrl?: string | null; ownerApprovedBy?: string | null; ownerApprovedAt?: Date | null; effectiveAt?: Date | null; expiresAt?: Date | null; now?: Date }) {
  const blockers: string[] = [];
  const now = input.now ?? new Date();
  if (!Number.isInteger(input.retentionDays) || input.retentionDays < 1) blockers.push("retention_period_invalid");
  if (!/^[A-Z]{2}$/.test(input.jurisdictionState.toUpperCase())) blockers.push("jurisdiction_invalid");
  if (!input.counselReviewer || !input.counselApprovedAt || !input.counselEvidenceUrl) blockers.push("counsel_approval_missing");
  if (!input.ownerApprovedBy || !input.ownerApprovedAt) blockers.push("owner_approval_missing");
  if (!input.effectiveAt || input.effectiveAt > now) blockers.push("policy_not_effective");
  if (!input.expiresAt || input.expiresAt <= now) blockers.push("policy_expired_or_expiry_missing");
  return { allowed: blockers.length === 0, blockers };
}

export function evaluateRetentionReview(input: { dueAt: Date; legalHoldReason?: string | null; policyActive: boolean; now?: Date }) {
  const now = input.now ?? new Date();
  if (input.legalHoldReason?.trim()) return { status: "LEGAL_HOLD" as const, automaticDeletionAllowed: false, blockers: ["legal_hold"] };
  if (!input.policyActive) return { status: "RETAIN" as const, automaticDeletionAllowed: false, blockers: ["retention_policy_inactive"] };
  if (input.dueAt > now) return { status: "RETAIN" as const, automaticDeletionAllowed: false, blockers: ["retention_period_not_elapsed"] };
  return { status: "ELIGIBLE_FOR_MANUAL_DELETION" as const, automaticDeletionAllowed: false, blockers: ["owner_review_and_immutable_record_check_required"] };
}

const sensitiveKey = /(email|phone|recipient|mailing|address|ownername|contactname|token|secret|password|credential)/i;
export function redactSensitiveAuditDetails(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveAuditDetails);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sensitiveKey.test(key) ? "[REDACTED]" : redactSensitiveAuditDetails(item)]));
}

