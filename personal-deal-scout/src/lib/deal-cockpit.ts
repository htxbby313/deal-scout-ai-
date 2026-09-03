import type { AcquisitionStageName } from "@/lib/acquisition-funnel";
import type { OwnerQueueItem } from "@/lib/funnel-owner-queue";

const STAGE_LABELS: Record<AcquisitionStageName, string> = {
  DISCOVERED: "New Lead",
  RESEARCHABLE: "Researching",
  BUYER_FIT: "Qualified",
  OUTREACH_READY: "Contacted",
  SELLER_ENGAGED: "Contacted",
  UNDERWRITING_READY: "Negotiating",
  OFFER_READY: "Offer Sent",
  CONTRACTED: "Under Contract",
  DISPOSITION_READY: "Disposition",
  CLOSED: "Closed",
  DISQUALIFIED: "Lost",
  NURTURE: "Contacted",
  ARCHIVED: "Lost",
};

export function acquisitionStageLabel(
  stage?: string | null,
  options?: { matchCount?: number },
) {
  if (!stage) return "New Lead";
  if (stage === "DISPOSITION_READY" && (options?.matchCount ?? 0) > 0) {
    return "Buyer Matching";
  }
  return STAGE_LABELS[stage as AcquisitionStageName] ?? stage.replaceAll("_", " ");
}

export function confidenceBand(
  average?: number | null,
  verifiedCount = 0,
): "Solid" | "Thin" | "No data" {
  if (verifiedCount <= 0 || average == null) return "No data";
  if (average >= 70) return "Solid";
  return "Thin";
}

export function offerVerdict(input: {
  conflictCount: number;
  sellerSafeMaximumCents?: bigint | null;
  projectedSpreadCents?: bigint | null;
}) {
  if (
    input.conflictCount > 0 ||
    input.sellerSafeMaximumCents == null ||
    input.projectedSpreadCents == null
  ) {
    return "Insufficient verified data — do not offer yet";
  }
  if (input.projectedSpreadCents > BigInt(0)) return "Work this deal";
  return "Pass — projected spread does not support an offer";
}

export const ownerQueueCtaLabels: Record<OwnerQueueItem["kind"], string> = {
  AGENT_TASK: "Review recommendation",
  TRANSACTION_APPROVAL: "Review approval",
  FUNNEL_BLOCKER: "Open deal",
  SELLER_ENGAGEMENT: "Open seller",
  DEVELOPER_DRAFT: "Review buyer draft",
  CONTRACT_TEMPLATE: "Review contract",
};

export function ownerQueueCtaLabel(kind: OwnerQueueItem["kind"]) {
  return ownerQueueCtaLabels[kind];
}

export function sellerConversationHref(input: {
  engagementId?: string | null;
  address?: string | null;
}) {
  if (input.engagementId) {
    return `/seller-crm?engagementId=${encodeURIComponent(input.engagementId)}`;
  }
  if (input.address) {
    return `/seller-crm?q=${encodeURIComponent(input.address)}`;
  }
  return "/seller-crm";
}

export const DEAL_BOX_NO_CONVERSATION =
  "No conversation recorded on this deal.";
export const DEAL_BOX_START_PURPOSE = "Seller relationship for this deal";
export const DEAL_BOX_RECORD_EVIDENCE_COPY = "Saves evidence; does not send.";

export function sellerFactsHref(engagementId: string) {
  return `/seller-crm?engagementId=${encodeURIComponent(engagementId)}#seller-intake`;
}

export function defaultDealSellerRecipient(property: {
  contactPhone?: string | null;
  contactEmail?: string | null;
  ownerName?: string | null;
}) {
  return (
    property.contactPhone?.trim() ||
    property.contactEmail?.trim() ||
    property.ownerName?.trim() ||
    ""
  );
}
