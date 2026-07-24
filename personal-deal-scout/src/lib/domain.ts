export function normalizedPropertyKey(address: string, zipCode: string) {
  return `${address.trim().toLowerCase()}|${zipCode.trim()}`;
}

export function canSendOutbound(input: {
  approvalStatus: string;
  systemMode: string;
  providerEnabled: boolean;
  providerConfigured: boolean;
  environmentConfigured: boolean;
}) {
  return input.approvalStatus === "APPROVED"
    && input.systemMode === "ACTIVE"
    && input.providerEnabled
    && input.providerConfigured
    && input.environmentConfigured;
}

export function completedTask<T extends { status: string }>(task: T) {
  return { ...task, status: "DONE" as const };
}

export function approvedMessage<T extends { status: string }>(message: T) {
  return { ...message, status: "APPROVED" as const };
}

export function auditEntry(type: string, summary: string, details?: Record<string, unknown>) {
  return { type, summary, details };
}
