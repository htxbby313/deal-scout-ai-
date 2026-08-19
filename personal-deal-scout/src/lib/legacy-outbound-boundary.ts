export function evaluateLegacyOutboundBoundary(input: { approvalStatus: string; transactionActive: boolean; suppressionClear: boolean; consentCurrent: boolean; stateProcedureCurrent: boolean; disclosurePresent: boolean; contactWindowVerified: boolean; providerReady: boolean; operationAllowed: boolean; adapterReviewed: boolean }) {
  const blockers = [input.approvalStatus !== "APPROVED" && "owner_approval_missing", !input.transactionActive && "active_transaction_missing", !input.suppressionClear && "suppression_not_clear", !input.consentCurrent && "consent_missing", !input.stateProcedureCurrent && "state_procedure_missing", !input.disclosurePresent && "required_disclosure_missing", !input.contactWindowVerified && "contact_window_not_verified", !input.providerReady && "provider_not_ready", !input.operationAllowed && "operation_not_allowed", !input.adapterReviewed && "reviewed_adapter_missing"].filter(Boolean) as string[];
  return { allowed: blockers.length === 0, blockers };
}

