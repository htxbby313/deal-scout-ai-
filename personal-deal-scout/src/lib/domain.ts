export function normalizedPropertyKey(address: string, zipCode: string) {
  return `${address.trim().toLowerCase()}|${zipCode.trim()}`;
}

export type PropertyReadinessInput = {
  opportunityStatus: string;
  estimatedValue?: number | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactUrl?: string | null;
  sourceUrl?: string | null;
  verificationSourceUrl?: string | null;
  verificationDate?: string | null;
};

export function propertyReadiness(property: PropertyReadinessInput) {
  const missing: string[] = [];
  if (!["CONFIRMED_AVAILABLE", "GOVERNMENT_SALE"].includes(property.opportunityStatus)) missing.push("confirmed availability");
  if (!property.sourceUrl) missing.push("original source");
  if (!property.estimatedValue || property.estimatedValue <= 0) missing.push("current asking price");
  if (!property.contactPhone) missing.push("verified seller or broker phone");
  if (!property.verificationSourceUrl) missing.push("price/contact evidence URL");
  if (!property.verificationDate) missing.push("verification date");
  return { actionable: missing.length === 0, missing };
}

export function formatSourceRecordDate(value?: string | null) {
  if (!value?.trim()) return "Missing";
  const raw = value.trim();
  const numeric = Number(raw);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
    : new Date(raw);
  if (Number.isNaN(date.getTime())) return "Unrecognized date";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

export function developerMatchesAreVerified(property: PropertyReadinessInput) {
  return propertyReadiness(property).actionable;
}

export type ResearchPriorityInput = {
  opportunityStatus: string;
  confidence?: number | null;
  sourceUrl?: string | null;
  verificationSourceUrl?: string | null;
  verificationDate?: string | Date | null;
  estimatedValue?: number | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactUrl?: string | null;
};

export function researchPriorityScore(property: ResearchPriorityInput) {
  let score = Math.max(0, Math.min(100, property.confidence ?? 0));
  if (["CONFIRMED_AVAILABLE", "GOVERNMENT_SALE"].includes(property.opportunityStatus)) score += 100;
  else if (property.opportunityStatus === "DEVELOPMENT_SIGNAL") score += 40;
  if (property.sourceUrl) score += 25;
  if (property.verificationSourceUrl) score += 25;
  if (property.verificationDate) score += 15;
  if (property.estimatedValue && property.estimatedValue > 0) score += 15;
  if (property.contactPhone) score += 20;
  if (property.contactEmail) score += 10;
  if (property.contactUrl) score += 5;
  return score;
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
