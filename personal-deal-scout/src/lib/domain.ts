export function normalizedPropertyKey(address: string, zipCode: string) {
  return `${address.trim().toLowerCase()}|${zipCode.trim()}`;
}

export type PropertyReadinessInput = {
  opportunityStatus: string;
  estimatedValue?: number | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  sourceUrl?: string | null;
  verificationSourceUrl?: string | null;
  verificationDate?: string | null;
};

export function propertyReadiness(property: PropertyReadinessInput) {
  const missing: string[] = [];
  if (!["CONFIRMED_AVAILABLE", "GOVERNMENT_SALE"].includes(property.opportunityStatus)) missing.push("confirmed availability");
  if (!property.sourceUrl) missing.push("original source");
  if (!property.estimatedValue || property.estimatedValue <= 0) missing.push("current asking price");
  if (!property.contactPhone && !property.contactEmail) missing.push("usable seller contact");
  if (!property.verificationSourceUrl) missing.push("price/contact evidence URL");
  if (!property.verificationDate) missing.push("verification date");
  return { actionable: missing.length === 0, missing };
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
