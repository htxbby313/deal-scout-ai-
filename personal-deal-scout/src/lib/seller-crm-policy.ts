export function evaluateContactAttempt(input: { suppressed: boolean; consentGranted: boolean; policyActive: boolean; insidePermittedWindow: boolean; ownerApproved: boolean; providerReady: boolean; transactionControlStatus: "ACTIVE" | "ON_HOLD" | "STOPPED" }) {
  const blockers = [input.suppressed && "suppressed", !input.consentGranted && "consent_missing", !input.policyActive && "policy_inactive", !input.insidePermittedWindow && "outside_permitted_window", !input.ownerApproved && "owner_approval_missing", !input.providerReady && "provider_not_ready", input.transactionControlStatus !== "ACTIVE" && `transaction_${input.transactionControlStatus.toLowerCase()}`].filter(Boolean) as string[];
  return { canDeliver: blockers.length === 0, blockers, nextAllowedAction: blockers.length ? "INTERNAL_REVIEW" : "OWNER_INITIATED_DELIVERY" };
}
export function validateSellerFacts(input: { sellerStatedAt: Date; conversationOccurredAt: Date; desiredProceedsCents?: bigint; minimumNetProceedsCents?: bigint; authorityStatus: string; authoritySourceUrl?: string; independentAdviceRequired: boolean; independentAdviceOfferedAt?: Date; now: Date }) {
  const blockers: string[] = [];
  if (input.sellerStatedAt < input.conversationOccurredAt || input.sellerStatedAt > input.now) blockers.push("invalid_seller_statement_time");
  if ((input.desiredProceedsCents ?? BigInt(0)) < BigInt(0) || (input.minimumNetProceedsCents ?? BigInt(0)) < BigInt(0)) blockers.push("negative_proceeds");
  if (["DOCUMENTED","VERIFIED"].includes(input.authorityStatus) && !input.authoritySourceUrl) blockers.push("authority_source_missing");
  if (input.independentAdviceRequired && !input.independentAdviceOfferedAt) blockers.push("independent_advice_not_offered");
  return { valid: blockers.length === 0, blockers };
}
export function evaluateOfferStatus(input: { requestedStatus: string; ownerApprovedAt?: Date; ownerApprovedBy?: string; transactionActive: boolean; financialProjectionId?: string; documentVersionId?: string; expiresAt?: Date; now: Date }) {
  const blockers: string[] = [];
  if (input.requestedStatus !== "DRAFT" && (!input.ownerApprovedAt || !input.ownerApprovedBy)) blockers.push("owner_approval_missing");
  if (input.requestedStatus !== "DRAFT" && !input.transactionActive) blockers.push("transaction_not_active");
  if (["OWNER_APPROVED","DELIVERED_MANUALLY","ACCEPTED"].includes(input.requestedStatus) && (!input.financialProjectionId || !input.documentVersionId)) blockers.push("offer_artifacts_missing");
  if (input.expiresAt && input.expiresAt <= input.now && !["EXPIRED","WITHDRAWN","REJECTED"].includes(input.requestedStatus)) blockers.push("offer_expired");
  return { allowed: blockers.length === 0, blockers };
}
