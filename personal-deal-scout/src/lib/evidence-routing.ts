export type EvidenceRouteStatus = "COMPLETE" | "NEEDS_MANUAL_VERIFICATION";
export type EvidenceOrigin = "PUBLIC_SOURCE" | "USER_ATTESTATION" | "AUTHORIZED_DOCUMENT";

export type EvidenceItem = {
  field: string;
  value?: unknown;
  sourceUrl?: string | null;
  observedAt?: string | null;
  verificationStatus: "VERIFIED" | "NOT_FOUND" | "CONFLICT" | "NEEDS_MANUAL_VERIFICATION";
  origin: EvidenceOrigin;
};

export type EvidenceRequirement = {
  field: string;
  label: string;
  acceptedOrigins: EvidenceOrigin[];
  maxAgeDays?: number;
  sourceUrlRequired?: boolean;
};

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}

function ageInDays(observedAt: string, evaluatedAt: string) {
  const observed = Date.parse(observedAt);
  const evaluated = Date.parse(evaluatedAt);
  if (!Number.isFinite(observed) || !Number.isFinite(evaluated) || observed > evaluated) return null;
  return Math.floor((evaluated - observed) / 86_400_000);
}

export function routeEvidenceCompleteness(input: {
  evidence: EvidenceItem[];
  requirements: EvidenceRequirement[];
  evaluatedAt: string;
}) {
  const missing: string[] = [];
  const stale: string[] = [];
  const conflicted: string[] = [];

  for (const requirement of input.requirements) {
    const candidates = input.evidence.filter((item) => item.field === requirement.field);
    if (candidates.some((item) => item.verificationStatus === "CONFLICT")) {
      conflicted.push(requirement.label);
      continue;
    }
    const verified = candidates.find((item) =>
      item.verificationStatus === "VERIFIED"
      && hasValue(item.value)
      && requirement.acceptedOrigins.includes(item.origin)
      && (!requirement.sourceUrlRequired || Boolean(item.sourceUrl)),
    );
    if (!verified?.observedAt) {
      missing.push(requirement.label);
      continue;
    }
    const age = ageInDays(verified.observedAt, input.evaluatedAt);
    if (age === null || (requirement.maxAgeDays !== undefined && age > requirement.maxAgeDays)) stale.push(requirement.label);
  }

  const manualNeeded = missing.length + stale.length + conflicted.length;
  return {
    status: (manualNeeded === 0 ? "COMPLETE" : "NEEDS_MANUAL_VERIFICATION") as EvidenceRouteStatus,
    manualNeeded,
    missing,
    stale,
    conflicted,
    verifiedCount: input.requirements.length - manualNeeded,
  };
}

export const SELLER_FIT_EVIDENCE_REQUIREMENTS: EvidenceRequirement[] = [
  { field: "sellerAuthority", label: "seller authority", acceptedOrigins: ["AUTHORIZED_DOCUMENT", "USER_ATTESTATION"], maxAgeDays: 30 },
  { field: "permissionToContact", label: "contact permission", acceptedOrigins: ["USER_ATTESTATION", "AUTHORIZED_DOCUMENT"], maxAgeDays: 365 },
  { field: "sellerGoals", label: "seller-stated goals", acceptedOrigins: ["USER_ATTESTATION"], maxAgeDays: 30 },
  { field: "minimumAcceptableProceeds", label: "seller minimum proceeds", acceptedOrigins: ["USER_ATTESTATION"], maxAgeDays: 30 },
  { field: "independentAdviceOffered", label: "independent advice offered", acceptedOrigins: ["USER_ATTESTATION", "AUTHORIZED_DOCUMENT"], maxAgeDays: 30 },
];

export const BUYER_QUALIFICATION_EVIDENCE_REQUIREMENTS: EvidenceRequirement[] = [
  { field: "buyerIdentity", label: "buyer identity", acceptedOrigins: ["PUBLIC_SOURCE", "AUTHORIZED_DOCUMENT"], maxAgeDays: 365, sourceUrlRequired: true },
  { field: "businessStatus", label: "business status", acceptedOrigins: ["PUBLIC_SOURCE", "AUTHORIZED_DOCUMENT"], maxAgeDays: 90, sourceUrlRequired: true },
  { field: "acquisitionCriteria", label: "acquisition criteria", acceptedOrigins: ["USER_ATTESTATION", "AUTHORIZED_DOCUMENT"], maxAgeDays: 90 },
  { field: "relevantPurchaseHistory", label: "relevant purchase history", acceptedOrigins: ["PUBLIC_SOURCE", "AUTHORIZED_DOCUMENT"], maxAgeDays: 365, sourceUrlRequired: true },
  { field: "proofOfFunds", label: "proof of funds", acceptedOrigins: ["AUTHORIZED_DOCUMENT"], maxAgeDays: 30, sourceUrlRequired: true },
  { field: "assignmentAccepted", label: "assignment acceptance", acceptedOrigins: ["USER_ATTESTATION", "AUTHORIZED_DOCUMENT"], maxAgeDays: 90 },
  { field: "communicationConsent", label: "buyer communication consent", acceptedOrigins: ["USER_ATTESTATION", "AUTHORIZED_DOCUMENT"], maxAgeDays: 365 },
];

export function routeSellerFitEvidence(evidence: EvidenceItem[], evaluatedAt: string) {
  return routeEvidenceCompleteness({ evidence, requirements: SELLER_FIT_EVIDENCE_REQUIREMENTS, evaluatedAt });
}

export function routeBuyerQualificationEvidence(evidence: EvidenceItem[], evaluatedAt: string) {
  return routeEvidenceCompleteness({ evidence, requirements: BUYER_QUALIFICATION_EVIDENCE_REQUIREMENTS, evaluatedAt });
}
