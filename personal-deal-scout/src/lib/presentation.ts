import type { AcquisitionStageName } from "@/lib/acquisition-funnel";

export const VISIBLE_STAGE_ORDER = [
  "NEW_LEAD",
  "QUALIFIED",
  "CONTACTING",
  "OFFER",
  "UNDER_CONTRACT",
  "CLOSED",
] as const;

export type VisibleStage = (typeof VISIBLE_STAGE_ORDER)[number];

const visibleStageLabels: Record<VisibleStage, string> = {
  NEW_LEAD: "New lead",
  QUALIFIED: "Qualified",
  CONTACTING: "Contacting",
  OFFER: "Offer",
  UNDER_CONTRACT: "Under contract",
  CLOSED: "Closed",
};

const acquisitionStageGroups: Record<AcquisitionStageName, VisibleStage | null> = {
  DISCOVERED: "NEW_LEAD",
  RESEARCHABLE: "NEW_LEAD",
  BUYER_FIT: "QUALIFIED",
  OUTREACH_READY: "QUALIFIED",
  SELLER_ENGAGED: "CONTACTING",
  NURTURE: "CONTACTING",
  UNDERWRITING_READY: "OFFER",
  OFFER_READY: "OFFER",
  CONTRACTED: "UNDER_CONTRACT",
  DISPOSITION_READY: "UNDER_CONTRACT",
  CLOSED: "CLOSED",
  DISQUALIFIED: null,
  ARCHIVED: null,
};

const labels: Record<string, string> = {
  PENDING: "Pending",
  PENDING_APPROVAL: "Needs approval",
  NEEDS_MANUAL_VERIFICATION: "Needs review",
  CONFIRMED_AVAILABLE: "Available",
  GOVERNMENT_SALE: "Government sale",
  DEVELOPMENT_SIGNAL: "Development opportunity",
  REJECTED: "Not a fit",
  DRAFT: "Draft",
  APPROVED: "Approved",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  STOPPED: "Stopped",
  SATISFIED: "Complete",
  FAILED: "Failed",
  EXPIRED: "Expired",
  WAIVED: "Waived",
  VERIFIED: "Verified",
  SUPERSEDED: "Replaced",
  NEW: "New",
  ATTEMPTED_CONTACT: "Attempted contact",
  TALKING: "Talking",
  FOLLOW_UP: "Follow-up",
  APPOINTMENT_SET: "Appointment set",
  OFFER_MADE: "Offer made",
  NOT_INTERESTED: "Not interested",
  DO_NOT_CONTACT: "Do not contact",
  PHONE: "Phone",
  SMS: "Text message",
  EMAIL: "Email",
};

export function visibleStageFor(stage: AcquisitionStageName) {
  return acquisitionStageGroups[stage];
}

export function visibleStageLabel(stage: VisibleStage) {
  return visibleStageLabels[stage];
}

export function humanLabel(value: string | null | undefined) {
  if (!value?.trim()) return "Not set";
  const normalized = value.trim().toUpperCase();
  const stage = acquisitionStageGroups[normalized as AcquisitionStageName];
  if (stage) return visibleStageLabels[stage];
  return labels[normalized] ?? sentenceCase(normalized);
}

export function sentenceCase(value: string) {
  const words = value.trim().toLowerCase().split(/[_\s-]+/).filter(Boolean);
  if (!words.length) return "Not set";
  return `${words[0][0].toUpperCase()}${words[0].slice(1)}${words.length > 1 ? ` ${words.slice(1).join(" ")}` : ""}`;
}

