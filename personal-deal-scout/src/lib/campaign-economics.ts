export type CampaignBoundarySnapshot = { allowedStates: readonly string[]; allowedCounties: readonly string[]; allowedCities: readonly string[]; allowedZipCodes: readonly string[]; allowedNeighborhoods: readonly string[]; includedPropertyTypes: readonly string[]; excludedPropertyTypes: readonly string[]; minimumRequiredProfitCents?: bigint | null; maximumEarnestMoneyCents?: bigint | null; maximumResearchCostCents?: bigint | null; maximumOutreachCostCents?: bigint | null; evidenceFreshnessHours?: number | null };
export function evaluateCampaignLifecycle(input: { status: string; ownerApprovedAt?: Date | null; startsAt?: Date | null; endsAt?: Date | null; boundaryCount: number; requiredCountyCount: number; coveredCountyCount: number; now: Date }) {
  const blockers: string[] = [];
  if (input.status !== "APPROVED") blockers.push("campaign_not_approved");
  if (!input.ownerApprovedAt) blockers.push("owner_approval_missing");
  if (!input.startsAt || input.startsAt > input.now) blockers.push("campaign_not_started");
  if (!input.endsAt || input.endsAt <= input.now) blockers.push("campaign_expired");
  if (input.boundaryCount !== 1) blockers.push("current_boundary_missing_or_ambiguous");
  if (input.coveredCountyCount < input.requiredCountyCount) blockers.push("county_coverage_incomplete");
  return { allowed: blockers.length === 0, blockers };
}
export function evaluateCampaignOpportunity(input: { boundary: CampaignBoundarySnapshot; property: { state: string; county?: string | null; city: string; zipCode: string; neighborhood?: string | null; propertyType: string }; projectedProfitCents?: bigint | null; earnestMoneyCents?: bigint | null; evidenceObservedAt?: Date | null; countyCoverageStatus?: string | null; researchCostCents: bigint; outreachCostCents: bigint; now: Date }) {
  const blockers: string[] = []; const b = input.boundary; const upper = (items: readonly string[]) => items.map((item) => item.toUpperCase());
  if (b.allowedStates.length && !upper(b.allowedStates).includes(input.property.state.toUpperCase())) blockers.push("state_outside_campaign");
  if (b.allowedCounties.length && !input.property.county?.trim()) blockers.push("county_missing"); else if (b.allowedCounties.length && !upper(b.allowedCounties).includes(input.property.county!.toUpperCase())) blockers.push("county_outside_campaign");
  if (b.allowedCities.length && !upper(b.allowedCities).includes(input.property.city.toUpperCase())) blockers.push("city_outside_campaign");
  if (b.allowedZipCodes.length && !b.allowedZipCodes.includes(input.property.zipCode)) blockers.push("zip_outside_campaign");
  if (b.allowedNeighborhoods.length && (!input.property.neighborhood || !upper(b.allowedNeighborhoods).includes(input.property.neighborhood.toUpperCase()))) blockers.push("neighborhood_outside_campaign");
  if (b.excludedPropertyTypes.map((item) => item.toLowerCase()).includes(input.property.propertyType.toLowerCase())) blockers.push("property_type_excluded");
  if (b.includedPropertyTypes.length && !b.includedPropertyTypes.map((item) => item.toLowerCase()).includes(input.property.propertyType.toLowerCase())) blockers.push("property_type_not_included");
  if (b.minimumRequiredProfitCents != null && (input.projectedProfitCents == null || input.projectedProfitCents < b.minimumRequiredProfitCents)) blockers.push("profit_below_campaign_minimum");
  if (b.maximumEarnestMoneyCents != null && (input.earnestMoneyCents ?? BigInt(0)) > b.maximumEarnestMoneyCents) blockers.push("earnest_money_above_campaign_limit");
  if (b.maximumResearchCostCents != null && input.researchCostCents > b.maximumResearchCostCents) blockers.push("research_cost_cap_exceeded");
  if (b.maximumOutreachCostCents != null && input.outreachCostCents > b.maximumOutreachCostCents) blockers.push("outreach_cost_cap_exceeded");
  if (b.evidenceFreshnessHours && (!input.evidenceObservedAt || input.now.getTime() - input.evidenceObservedAt.getTime() > b.evidenceFreshnessHours * 3_600_000)) blockers.push("evidence_stale");
  if (b.allowedCounties.length && !["AUTOMATED","MANUAL_ONLY"].includes(input.countyCoverageStatus ?? "")) blockers.push("county_coverage_unresolved");
  return { eligible: blockers.length === 0, blockers };
}
export function buildCampaignKpis(input: { opportunities: readonly { stage: string; realizedProfitCents?: bigint | null }[]; costs: readonly { type: string; amountCents: bigint }[]; goals?: { closeTarget?: number | null; realizedProfitTargetCents?: bigint | null } | null }) { const sum = (values: readonly bigint[]) => values.reduce((a,b) => a+b, BigInt(0)); const realized = sum(input.opportunities.flatMap((item) => item.realizedProfitCents == null ? [] : [item.realizedProfitCents])); const cost = sum(input.costs.map((item) => item.amountCents)); const closed = input.opportunities.filter((item) => item.stage === "CLOSED").length; return { opportunityCount: input.opportunities.length, closed, realizedProfitCents: realized, attributedCostCents: cost, netAfterAttributedCostCents: realized - cost, closeGoalProgress: input.goals?.closeTarget ? { numerator: closed, denominator: input.goals.closeTarget } : null, profitGoalProgress: input.goals?.realizedProfitTargetCents ? { numerator: realized, denominator: input.goals.realizedProfitTargetCents } : null }; }
