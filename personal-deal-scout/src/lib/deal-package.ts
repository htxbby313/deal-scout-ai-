export type PackageMedia = {
  id: string;
  url: string;
  sourceUrl: string;
  sourceName: string;
  rightsStatus: string;
  sendApproved: boolean;
  rightsEvidenceUrl?: string | null;
  externalApprovedAt?: Date | null;
};
export function mediaEligibleForExternalPackage(media: PackageMedia) {
  if (!media.sendApproved || !media.externalApprovedAt) return false;
  if (
    ![
      "OWNED",
      "LICENSED",
      "PERMISSION_DOCUMENTED",
      "EXTERNAL_APPROVED",
    ].includes(media.rightsStatus)
  )
    return false;
  if (
    ["LICENSED", "PERMISSION_DOCUMENTED"].includes(media.rightsStatus) &&
    !media.rightsEvidenceUrl?.startsWith("https://")
  )
    return false;
  return media.sourceUrl.startsWith("https://");
}

export function packageReadiness(input: {
  propertySourceUrl?: string | null;
  verifiedFindingCount: number;
  conflictCount: number;
  transactionControlStatus?: string | null;
  projectionEvidence: boolean;
  media: PackageMedia[];
}) {
  const blockers: string[] = [];
  if (!input.propertySourceUrl?.startsWith("https://"))
    blockers.push("property_source_missing");
  if (!input.verifiedFindingCount)
    blockers.push("verified_property_evidence_missing");
  if (input.conflictCount) blockers.push("unresolved_evidence_conflicts");
  if (input.transactionControlStatus === "STOPPED")
    blockers.push("transaction_stopped");
  return {
    ready: blockers.length === 0,
    blockers,
    externalMedia: input.media.filter(mediaEligibleForExternalPackage),
    projectedNumbersIncluded: input.projectionEvidence,
  };
}
