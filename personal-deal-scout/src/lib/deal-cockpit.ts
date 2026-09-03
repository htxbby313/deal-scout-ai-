import type { AcquisitionStageName } from "@/lib/acquisition-funnel";
import type { OwnerQueueItem } from "@/lib/funnel-owner-queue";

const STAGE_LABELS: Record<AcquisitionStageName, string> = {
  DISCOVERED: "New Lead",
  RESEARCHABLE: "Analyzing",
  BUYER_FIT: "Analyzing",
  OUTREACH_READY: "Contacted",
  SELLER_ENGAGED: "Contacted",
  UNDERWRITING_READY: "Analyzing",
  OFFER_READY: "Offer",
  CONTRACTED: "Contract",
  DISPOSITION_READY: "Disposition",
  CLOSED: "Closed",
  DISQUALIFIED: "Lost",
  NURTURE: "Nurture",
  ARCHIVED: "Lost",
};

export function acquisitionStageLabel(stage?: string | null) {
  if (!stage) return "New Lead";
  return STAGE_LABELS[stage as AcquisitionStageName] ?? stage.replaceAll("_", " ");
}

export function isLostOrNurtureStage(stage?: string | null) {
  return stage === "DISQUALIFIED" || stage === "NURTURE" || stage === "ARCHIVED";
}

export function dealBoxPrimaryCta(input: {
  stage?: string | null;
  propertyId: string;
  transactionId?: string | null;
}) {
  const stage = input.stage ?? "DISCOVERED";
  const transactionHref = input.transactionId
    ? `/transactions?transaction=${encodeURIComponent(input.transactionId)}`
    : "/transactions";
  if (stage === "OFFER_READY") {
    return { label: "Make Offer", href: transactionHref };
  }
  if (stage === "CONTRACTED") {
    return { label: "Send Contract", href: transactionHref };
  }
  if (stage === "DISPOSITION_READY") {
    return { label: "Match Buyers", href: `#buyers` };
  }
  if (stage === "OUTREACH_READY" || stage === "SELLER_ENGAGED") {
    return { label: "Continue seller", href: `#overview` };
  }
  if (stage === "DISCOVERED") {
    return { label: "Qualify", href: `#overview` };
  }
  return { label: "Analyze", href: `#numbers` };
}

const DISPLAYABLE_MEDIA_RIGHTS = new Set([
  "OWNED",
  "LICENSED",
  "PERMISSION_DOCUMENTED",
  "EXTERNAL_APPROVED",
]);

export function dealBoxThumbnailUrl(
  media: ReadonlyArray<{
    url: string;
    kind: string;
    rightsStatus: string;
    position: number;
  }>,
) {
  const photo = [...media]
    .filter(
      (item) =>
        item.kind === "LISTING_PHOTO" &&
        DISPLAYABLE_MEDIA_RIGHTS.has(item.rightsStatus),
    )
    .sort((left, right) => left.position - right.position)[0];
  return photo?.url ?? null;
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
