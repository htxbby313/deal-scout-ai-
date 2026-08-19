import type { ConsentStatus, EngagementChannel, TransactionControlStatus } from "@prisma/client";

export type EngagementGateInput = {
  transactionControl: TransactionControlStatus;
  transactionState: string;
  engagementState: string;
  channel: EngagementChannel;
  ownerApproved: boolean;
  suppressed: boolean;
  consentStatus?: ConsentStatus;
  consentExpiresAt?: Date | null;
  statePolicy?: { enabled: boolean; counselApprovedAt?: Date | null; reviewedAt?: Date | null } | null;
  providerReady: boolean;
  now?: Date;
};

export function evaluateEngagementGate(input: EngagementGateInput) {
  const reasons: string[] = [];
  const now = input.now ?? new Date();
  const external = input.channel !== "INTERNAL";
  if (input.transactionControl !== "ACTIVE") reasons.push(`Transaction control is ${input.transactionControl}.`);
  if (input.transactionState.toUpperCase() !== input.engagementState.toUpperCase()) reasons.push("Engagement jurisdiction does not match the transaction.");
  if (input.suppressed) reasons.push("The recipient or channel is suppressed.");
  if (!input.ownerApproved) reasons.push("Owner approval is required.");
  if (external && (!input.statePolicy?.enabled || !input.statePolicy.counselApprovedAt || !input.statePolicy.reviewedAt)) reasons.push("A current counsel-reviewed state/channel policy is required.");
  if (external && (input.consentStatus !== "GRANTED" || (input.consentExpiresAt && input.consentExpiresAt <= now))) reasons.push("Current documented channel consent is required.");
  if (external && !input.providerReady) reasons.push("The provider integration is not ready.");
  return { allowed: reasons.length === 0, reasons };
}
export function evaluateProviderReadiness(input: {
  credentialsConfigured: boolean;
  webhookVerified: boolean;
  suppressionIntegrated: boolean;
  auditIntegrated: boolean;
  ownerEnabled: boolean;
}) {
  const missing = Object.entries(input).filter(([, value]) => !value).map(([key]) => key);
  return { ready: missing.length === 0, missing };
}
