import { contractTemplateCanBeUsed } from "@/lib/contract-template-policy";
import { evaluateProviderReadiness } from "@/lib/engagement-safety-policy";

export function evaluateContractProviderBoundary(input: {
  transactionControl: "ACTIVE" | "ON_HOLD" | "STOPPED";
  transactionState: string;
  ownerActionApproved: boolean;
  template: { status: string; jurisdictionState: string; activatedAt?: Date | null; effectiveAt?: Date | null; expiresAt?: Date | null } | null;
  provider: { credentialsConfigured: boolean; webhookVerified: boolean; suppressionIntegrated: boolean; auditIntegrated: boolean; ownerEnabled: boolean; environment: string; environmentConfigured: boolean; authenticationVerified: boolean; allowedOperations: string[]; idempotencyVerified: boolean; retryBoundariesVerified: boolean; sandboxVerified: boolean; productionOwnerApprovedAt?: Date | null } | null;
  now?: Date;
}) {
  const blockers: string[] = [];
  const now = input.now ?? new Date();
  if (input.transactionControl !== "ACTIVE") blockers.push(`transaction_${input.transactionControl.toLowerCase()}`);
  if (!input.ownerActionApproved) blockers.push("owner_action_approval_missing");
  if (!input.template || !contractTemplateCanBeUsed({ ...input.template, transactionState: input.transactionState, now })) blockers.push("active_jurisdiction_template_missing");
  if (!input.provider || !evaluateProviderReadiness(input.provider).ready) blockers.push("provider_not_ready");
  return { prerequisitesSatisfied: blockers.length === 0, executionAuthorized: false, blockers: [...blockers, "execution_requires_separate_human_action"] };
}
