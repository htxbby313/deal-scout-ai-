export const ACQUISITION_STAGE_ORDER = [
  "DISCOVERED",
  "RESEARCHABLE",
  "BUYER_FIT",
  "OUTREACH_READY",
  "SELLER_ENGAGED",
  "UNDERWRITING_READY",
  "OFFER_READY",
  "CONTRACTED",
  "DISPOSITION_READY",
  "CLOSED",
] as const;

export type AcquisitionStageName =
  | (typeof ACQUISITION_STAGE_ORDER)[number]
  | "DISQUALIFIED"
  | "NURTURE"
  | "ARCHIVED";
export type AcquisitionGateName =
  | "PROPERTY_EVIDENCE"
  | "SELLER_CONTACT"
  | "UNDERWRITING"
  | "COMPLIANCE"
  | "CONTRACT"
  | "BUYER_COVERAGE"
  | "DISPOSITION"
  | "CLOSING";

export type GateSnapshot = {
  type: AcquisitionGateName;
  version: number;
  status: "PENDING" | "SATISFIED" | "FAILED" | "EXPIRED" | "WAIVED";
  expiresAt?: Date | string | null;
};

const requiredGate: Partial<Record<AcquisitionStageName, AcquisitionGateName>> =
  {
    RESEARCHABLE: "PROPERTY_EVIDENCE",
    BUYER_FIT: "BUYER_COVERAGE",
    OUTREACH_READY: "COMPLIANCE",
    SELLER_ENGAGED: "SELLER_CONTACT",
    UNDERWRITING_READY: "UNDERWRITING",
    OFFER_READY: "COMPLIANCE",
    CONTRACTED: "CONTRACT",
    DISPOSITION_READY: "DISPOSITION",
    CLOSED: "CLOSING",
  };

function date(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const REQUIRED_TRANSACTION_STATUS: Partial<
  Record<AcquisitionStageName, readonly string[]>
> = {
  CONTRACTED: [
    "UNDER_CONTRACT",
    "BUYER_MATCHING",
    "ASSIGNMENT_PENDING",
    "CLOSING_PENDING",
  ],
  DISPOSITION_READY: [
    "BUYER_MATCHING",
    "ASSIGNMENT_PENDING",
    "CLOSING_PENDING",
  ],
  CLOSED: ["COMPLETED"],
};

export function evaluateStageTransition(input: {
  currentStage: AcquisitionStageName;
  nextStage: AcquisitionStageName;
  gates: readonly GateSnapshot[];
  transactionControlStatus: "ACTIVE" | "ON_HOLD" | "STOPPED";
  transactionStatus?: string | null;
  now: Date;
}) {
  const blockers: string[] = [];
  if (input.transactionControlStatus !== "ACTIVE")
    blockers.push(
      `transaction_${input.transactionControlStatus.toLowerCase()}`,
    );
  const requiredStatuses = REQUIRED_TRANSACTION_STATUS[input.nextStage];
  if (
    requiredStatuses &&
    !requiredStatuses.includes(input.transactionStatus ?? "")
  )
    blockers.push("transaction_status_not_contracted");
  const currentIndex = ACQUISITION_STAGE_ORDER.indexOf(
    input.currentStage as (typeof ACQUISITION_STAGE_ORDER)[number],
  );
  const nextIndex = ACQUISITION_STAGE_ORDER.indexOf(
    input.nextStage as (typeof ACQUISITION_STAGE_ORDER)[number],
  );
  if (currentIndex < 0 || nextIndex !== currentIndex + 1)
    blockers.push("invalid_stage_transition");

  const gateType = requiredGate[input.nextStage];
  const gate = gateType ? latestAcquisitionGate(input.gates, gateType) : null;
  const expiresAt = date(gate?.expiresAt);
  if (gateType && (!gate || !["SATISFIED", "WAIVED"].includes(gate.status)))
    blockers.push(`gate_${gateType.toLowerCase()}_not_satisfied`);
  if (gateType && gate && expiresAt && expiresAt <= input.now)
    blockers.push(`gate_${gateType.toLowerCase()}_expired`);
  return {
    allowed: blockers.length === 0,
    blockers,
    requiredGate: gateType ?? null,
  };
}

export type BuyerDemandSnapshot = {
  id: string;
  developerId: string;
  status: "DRAFT" | "VERIFIED" | "EXPIRED" | "SUPERSEDED";
  states: readonly string[];
  counties: readonly string[];
  zipCodes: readonly string[];
  assetTypes: readonly string[];
  minPurchasePriceCents?: bigint | null;
  maxPurchasePriceCents?: bigint | null;
  minAcres?: number | null;
  maxAcres?: number | null;
  maxAssignmentFeeCents?: bigint | null;
  verifiedAt?: Date | string | null;
  expiresAt?: Date | string | null;
};

export type BuyerPropertySnapshot = {
  state: string;
  county?: string | null;
  zipCode: string;
  assetType: string;
  purchasePriceCents: bigint;
  acres?: number | null;
  assignmentFeeCents: bigint;
};

export function evaluateBuyerDemand(input: {
  demand: BuyerDemandSnapshot;
  property: BuyerPropertySnapshot;
  proofOfFunds: {
    status: string;
    amountCents?: bigint | null;
    expiresAt: Date | string;
  } | null;
  reliability: {
    status: string;
    completedClosings: number;
    failedClosings: number;
    expiresAt: Date | string;
  } | null;
  now: Date;
}) {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const { demand, property } = input;
  if (demand.status !== "VERIFIED" || !demand.verifiedAt)
    blockers.push("demand_not_verified");
  const demandExpiry = date(demand.expiresAt);
  if (!demandExpiry || demandExpiry <= input.now)
    blockers.push("demand_expired");

  const geographicMatch =
    demand.zipCodes.includes(property.zipCode) ||
    Boolean(
      property.county &&
      demand.counties
        .map((item) => item.toLowerCase())
        .includes(property.county.toLowerCase()),
    ) ||
    demand.states
      .map((item) => item.toUpperCase())
      .includes(property.state.toUpperCase());
  if (geographicMatch) reasons.push("geography_match");
  else blockers.push("geography_mismatch");
  if (
    demand.assetTypes
      .map((item) => item.toLowerCase())
      .includes(property.assetType.toLowerCase())
  )
    reasons.push("asset_type_match");
  else blockers.push("asset_type_mismatch");
  if (
    (demand.minPurchasePriceCents == null ||
      property.purchasePriceCents >= demand.minPurchasePriceCents) &&
    (demand.maxPurchasePriceCents == null ||
      property.purchasePriceCents <= demand.maxPurchasePriceCents)
  )
    reasons.push("purchase_price_match");
  else blockers.push("purchase_price_mismatch");
  if (
    property.acres == null ||
    ((demand.minAcres == null || property.acres >= demand.minAcres) &&
      (demand.maxAcres == null || property.acres <= demand.maxAcres))
  )
    reasons.push("acreage_match");
  else blockers.push("acreage_mismatch");
  if (
    demand.maxAssignmentFeeCents == null ||
    property.assignmentFeeCents <= demand.maxAssignmentFeeCents
  )
    reasons.push("assignment_fee_match");
  else blockers.push("assignment_fee_exceeds_limit");

  const pofExpiry = date(input.proofOfFunds?.expiresAt);
  if (
    input.proofOfFunds?.status === "VERIFIED" &&
    pofExpiry &&
    pofExpiry > input.now &&
    (input.proofOfFunds.amountCents ?? BigInt(0)) >= property.purchasePriceCents
  )
    reasons.push("capacity_verified");
  else blockers.push("capacity_not_verified");
  const reliabilityExpiry = date(input.reliability?.expiresAt);
  if (
    input.reliability?.status === "VERIFIED" &&
    reliabilityExpiry &&
    reliabilityExpiry > input.now &&
    input.reliability.completedClosings > 0
  )
    reasons.push("reliability_verified");
  else blockers.push("reliability_not_verified");

  return {
    eligible: blockers.length === 0,
    score: Math.round((reasons.length / 7) * 100),
    reasons,
    blockers,
  };
}

export function evaluateBuyerCoverage(
  coverage: readonly {
    developerId: string;
    role: "PRIMARY" | "BACKUP";
    status: string;
    expiresAt: Date | string;
  }[],
  now: Date,
) {
  const live = coverage.filter(
    (item) =>
      item.status === "CONFIRMED" &&
      Boolean(date(item.expiresAt) && date(item.expiresAt)! > now),
  );
  const primary = live.find((item) => item.role === "PRIMARY");
  const backup = live.find(
    (item) =>
      item.role === "BACKUP" && item.developerId !== primary?.developerId,
  );
  const blockers = [
    !primary && "primary_buyer_missing",
    !backup && "independent_backup_buyer_missing",
  ].filter(Boolean) as string[];
  return {
    covered: blockers.length === 0,
    primary: primary ?? null,
    backup: backup ?? null,
    blockers,
  };
}

export function evaluateCampaignActivation(input: {
  campaignStatus: string;
  transactionControlStatus: "ACTIVE" | "ON_HOLD" | "STOPPED";
  ownerApprovedAt?: Date | string | null;
  outboundEnabled: boolean;
  boundary: {
    allowedStates: readonly string[];
    allowedChannels: readonly string[];
    doNotContactEnforced: boolean;
    consentRequired: boolean;
    maxRecipientsPerDay: number;
    effectiveAt?: Date | string | null;
    expiresAt?: Date | string | null;
  } | null;
  jurisdictionState: string;
  channel: string;
  now: Date;
}) {
  const blockers: string[] = [];
  if (input.campaignStatus !== "APPROVED")
    blockers.push("campaign_not_approved");
  if (input.transactionControlStatus !== "ACTIVE")
    blockers.push(
      `transaction_${input.transactionControlStatus.toLowerCase()}`,
    );
  if (!input.ownerApprovedAt) blockers.push("owner_approval_missing");
  if (!input.outboundEnabled) blockers.push("outbound_disabled");
  if (!input.boundary) blockers.push("boundary_missing");
  if (input.boundary) {
    if (
      !input.boundary.allowedStates
        .map((state) => state.toUpperCase())
        .includes(input.jurisdictionState.toUpperCase())
    )
      blockers.push("jurisdiction_not_allowed");
    if (
      !input.boundary.allowedChannels
        .map((channel) => channel.toLowerCase())
        .includes(input.channel.toLowerCase())
    )
      blockers.push("channel_not_allowed");
    if (!input.boundary.doNotContactEnforced)
      blockers.push("do_not_contact_not_enforced");
    if (!input.boundary.consentRequired) blockers.push("consent_not_required");
    if (input.boundary.maxRecipientsPerDay < 1)
      blockers.push("recipient_limit_not_configured");
    const effectiveAt = date(input.boundary.effectiveAt);
    const expiresAt = date(input.boundary.expiresAt);
    if (!effectiveAt || effectiveAt > input.now)
      blockers.push("boundary_not_effective");
    if (!expiresAt || expiresAt <= input.now) blockers.push("boundary_expired");
  }
  return { allowed: blockers.length === 0, blockers };
}
import { latestAcquisitionGate } from "@/lib/acquisition-gate-versioning";
