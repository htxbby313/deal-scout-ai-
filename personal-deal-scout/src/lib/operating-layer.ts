import "server-only";

import { Prisma, type AcquisitionGateStatus, type AcquisitionGateType, type AcquisitionStage } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { evaluateStageTransition } from "@/lib/acquisition-funnel";
import { evaluateStageCriteria, type StageCriterion } from "@/lib/stage-criteria";
import { evaluateStoredProfitPriority } from "@/lib/profit-priority";
import { hasSufficientResearchEvidence } from "@/lib/property-research";
import { chunkedMap } from "@/lib/research-runtime";

export async function synchronizeAcquisitionFunnels(now = new Date()) {
  const db = getPrisma();
  const properties = await db.property.findMany({ where: { opportunityStatus: { not: "REJECTED" } }, include: { researchFindings: true, acquisitionFunnels: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { createdAt: "asc" } });
  const results = await chunkedMap(properties, 5, async (property) => {
    let created = 0; let advanced = 0;
    let funnel = property.acquisitionFunnels[0];
    if (!funnel) {
      funnel = await db.$transaction(async (tx) => {
        const record = await tx.acquisitionFunnel.create({ data: { propertyId: property.id, stage: "DISCOVERED", responsibleActor: "research_agent", nextReviewAt: new Date(now.getTime() + 7 * 86_400_000), expiresAt: new Date(now.getTime() + 7 * 86_400_000) } });
        await tx.acquisitionStageHistory.create({ data: { funnelId: record.id, sequence: 1, toStage: "DISCOVERED", actor: "system", reason: "Property entered the evidence-backed acquisition funnel.", evidence: { propertyId: property.id } } });
        return record;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      created += 1;
    }
    if (funnel.stage !== "DISCOVERED") return { created, advanced };
    const currentFindings = property.researchFindings.filter((finding) => finding.sourceUrl && now.getTime() - finding.observedAt.getTime() <= 7 * 86_400_000);
    if (!hasSufficientResearchEvidence(currentFindings, property.opportunityStatus)) return { created, advanced };
    await db.$transaction(async (tx) => {
      const current = await tx.acquisitionFunnel.findUniqueOrThrow({ where: { id: funnel.id } });
      if (current.stage !== "DISCOVERED") return;
      const latest = await tx.acquisitionStageHistory.findFirst({ where: { funnelId: funnel.id }, orderBy: { sequence: "desc" }, select: { sequence: true } });
      await tx.acquisitionStageHistory.updateMany({ where: { funnelId: funnel.id, exitedAt: null }, data: { exitedAt: now } });
      await tx.acquisitionFunnel.update({ where: { id: funnel.id }, data: { stage: "RESEARCHABLE", stageEnteredAt: now, lastActivityAt: now, responsibleActor: "research_agent", nextReviewAt: new Date(now.getTime() + 7 * 86_400_000), expiresAt: new Date(now.getTime() + 7 * 86_400_000) } });
      await tx.acquisitionStageHistory.create({ data: { funnelId: funnel.id, sequence: (latest?.sequence ?? 0) + 1, fromStage: "DISCOVERED", toStage: "RESEARCHABLE", actor: "system", reason: "Current public evidence is sufficient to evaluate this opportunity; unavailable noncritical facts remain follow-up items.", evidence: { verifiedTopics: currentFindings.filter((finding) => finding.status === "VERIFIED").map((finding) => finding.topic) } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    advanced += 1;
    return { created, advanced };
  });
  return { scanned: properties.length, created: results.reduce((sum, result) => sum + result.created, 0), advanced: results.reduce((sum, result) => sum + result.advanced, 0) };
}

export async function readOperatingLayer(filters: { stage?: string; status?: string; rank?: string } = {}) {
  const db = getPrisma();
  const [funnels, campaigns, buyerDemand, engagements, diligence, providers, outcomes, developers, stagePolicies] = await Promise.all([
    db.acquisitionFunnel.findMany({ where: filters.stage ? { stage: filters.stage as never } : undefined, include: { property: true, transaction: true, gates: { orderBy: { createdAt: "desc" } }, buyerCoverage: true, stageHistory: { orderBy: { sequence: "desc" }, take: 1 }, priorityScores: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 100 }),
    db.acquisitionCampaign.findMany({ where: filters.status ? { status: filters.status as never } : undefined, include: { boundaries: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 100 }),
    db.buyerDemandVersion.findMany({ include: { developer: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.sellerEngagement.findMany({ include: { transaction: { include: { property: true } }, consents: { orderBy: { capturedAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 100 }),
    db.diligenceReview.findMany({ include: { transaction: { include: { property: true } } }, orderBy: { updatedAt: "desc" }, take: 100 }),
    db.providerIntegrationReadiness.findMany({ orderBy: [{ channel: "asc" }, { provider: "asc" }], take: 100 }),
    db.transactionOutcome.findMany({ include: { transaction: { include: { property: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.developer.findMany({ where: { active: true }, orderBy: { companyName: "asc" }, select: { id: true, companyName: true }, take: 250 }),
    db.acquisitionStagePolicy.findMany({ orderBy: [{ stage: "asc" }, { version: "desc" }], take: 200 }),
  ]);
  return {
    funnels: funnels.map((funnel) => { const score = funnel.priorityScores[0]; const priority = score ? evaluateStoredProfitPriority({ score: score.totalScore, blockers: score.blockers, expiresAt: score.expiresAt, stage: funnel.stage, controlStatus: funnel.transaction?.controlStatus, now: new Date() }) : { visibleScore: null, blockers: ["priority_score_missing"] }; return { id: funnel.id, property: funnel.property.address, market: `${funnel.property.city}, ${funnel.property.state}`, stage: funnel.stage, enteredAt: funnel.stageEnteredAt.toISOString(), expiresAt: funnel.expiresAt?.toISOString() ?? null, controlStatus: funnel.transaction?.controlStatus ?? null, blockers: funnel.gates.filter((gate) => !["SATISFIED", "WAIVED"].includes(gate.status)).map((gate) => gate.type), buyerCoverage: funnel.buyerCoverage.filter((coverage) => coverage.status === "CONFIRMED").length, score: priority.visibleScore, priorityBlockers: priority.blockers, priorityReasons: score?.reasons ?? [], scoreCalculatedAt: score?.calculatedAt.toISOString() ?? null, reason: funnel.stageHistory[0]?.reason ?? "No stage explanation recorded." }; }).sort((left, right) => filters.rank === "profit-priority" ? (right.score ?? -1) - (left.score ?? -1) : 0),
    campaigns: campaigns.map((campaign) => ({ id: campaign.id, name: campaign.name, type: campaign.type, status: campaign.status, state: campaign.jurisdictionState, outboundEnabled: campaign.outboundEnabled, ownerApproved: Boolean(campaign.ownerApprovedAt), boundaryVersion: campaign.boundaries[0]?.version ?? null })),
    buyerDemand: buyerDemand.map((demand) => ({ id: demand.id, developerId: demand.developerId, developer: demand.developer.companyName, version: demand.version, status: demand.status, markets: [...demand.states, ...demand.counties, ...demand.zipCodes], expiresAt: demand.expiresAt?.toISOString() ?? null, sourceUrl: demand.sourceUrl })),
    stagePolicies: stagePolicies.map((policy) => ({ id: policy.id, stage: policy.stage, version: policy.version, active: policy.active })),
    engagements: engagements.map((engagement) => ({ id: engagement.id, property: engagement.transaction.property.address, channel: engagement.channel, status: engagement.status, consent: engagement.consents[0]?.status ?? "UNKNOWN" })),
    diligence: diligence.map((review) => ({ id: review.id, property: review.transaction.property.address, level: review.level, status: review.status, evidence: review.evidenceCount, unresolved: review.unresolvedCount })), providers, outcomes, developers: developers.map((developer) => ({ id: developer.id, name: developer.companyName })),
  };
}

function httpsUrl(raw: string) { const url = new URL(raw); if (url.protocol !== "https:") throw new Error("Evidence sources must use HTTPS."); return url.toString(); }
const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export async function createBuyerDemandRecord(input: { developerId: string; actor: string; states: string; counties: string; zipCodes: string; assetTypes: string; excludedAreas?: string; marketPolygons?: Prisma.InputJsonValue; minPurchasePriceCents?: bigint; maxPurchasePriceCents?: bigint; minCompletedValueCents?: bigint; maxCompletedValueCents?: bigint; minAcres?: number; maxAcres?: number; minLotWidthFeet?: number; maxLotWidthFeet?: number; minLotDepthFeet?: number; maxLotDepthFeet?: number; minFrontageFeet?: number; accessPreferences?: string; utilityPreferences?: string; zoningPreferences?: string; floodPreferences?: string; entitlementPreferences?: string; redevelopmentPreferences?: string; requiredClosingDays?: number; assignmentAcceptance?: string; doubleCloseAcceptance?: string; earnestMoneyExpectationCents?: bigint; inspectionRequirements?: string; decisionMakerName?: string; approvedChannel?: "EMAIL" | "SMS" | "PHONE" | "MAIL" | "INTERNAL"; currentBuyingStatus?: string; criteriaConfirmedAt?: Date; maxAssignmentFeeCents?: bigint; strategy?: string; sourceUrl: string; expiresAt: Date }) {
  if (input.expiresAt <= new Date()) throw new Error("Buyer criteria must have a future expiration.");
  return getPrisma().$transaction(async (tx) => {
    const latest = await tx.buyerDemandVersion.findFirst({ where: { developerId: input.developerId }, orderBy: { version: "desc" } });
    if (latest) await tx.buyerDemandVersion.update({ where: { id: latest.id }, data: { status: "SUPERSEDED" } });
    return tx.buyerDemandVersion.create({ data: { developerId: input.developerId, version: (latest?.version ?? 0) + 1, status: "DRAFT", states: list(input.states).map((item) => item.toUpperCase()), counties: list(input.counties), zipCodes: list(input.zipCodes), assetTypes: list(input.assetTypes), excludedAreas: list(input.excludedAreas ?? ""), marketPolygons: input.marketPolygons, minPurchasePriceCents: input.minPurchasePriceCents, maxPurchasePriceCents: input.maxPurchasePriceCents, minCompletedValueCents: input.minCompletedValueCents, maxCompletedValueCents: input.maxCompletedValueCents, minAcres: input.minAcres, maxAcres: input.maxAcres, minLotWidthFeet: input.minLotWidthFeet, maxLotWidthFeet: input.maxLotWidthFeet, minLotDepthFeet: input.minLotDepthFeet, maxLotDepthFeet: input.maxLotDepthFeet, minFrontageFeet: input.minFrontageFeet, accessPreferences: list(input.accessPreferences ?? ""), utilityPreferences: list(input.utilityPreferences ?? ""), zoningPreferences: list(input.zoningPreferences ?? ""), floodPreferences: list(input.floodPreferences ?? ""), entitlementPreferences: list(input.entitlementPreferences ?? ""), redevelopmentPreferences: list(input.redevelopmentPreferences ?? ""), requiredClosingDays: input.requiredClosingDays, assignmentAcceptance: input.assignmentAcceptance, doubleCloseAcceptance: input.doubleCloseAcceptance, earnestMoneyExpectationCents: input.earnestMoneyExpectationCents, inspectionRequirements: input.inspectionRequirements, decisionMakerName: input.decisionMakerName, approvedChannel: input.approvedChannel, currentBuyingStatus: input.currentBuyingStatus, criteriaConfirmedAt: input.criteriaConfirmedAt, maxAssignmentFeeCents: input.maxAssignmentFeeCents, strategy: input.strategy, sourceUrl: httpsUrl(input.sourceUrl), expiresAt: input.expiresAt, createdBy: input.actor } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createCampaignRecord(input: { name: string; state: string; type: "SELLER_ACQUISITION" | "BUYER_DISPOSITION"; actor: string; counties?: string; cities?: string; zipCodes?: string; neighborhoods?: string; radiusCenterLatitude?: number; radiusCenterLongitude?: number; radiusMiles?: number; mapPolygon?: Prisma.InputJsonValue; includedPropertyTypes?: string; excludedPropertyTypes?: string; acquisitionStrategy?: string; developmentFilters?: Prisma.InputJsonValue; priceFilters?: Prisma.InputJsonValue; targetBuyerGroup?: string; minimumRequiredProfitCents?: bigint; maximumEarnestMoneyCents?: bigint; maximumResearchCostCents?: bigint; maximumOutreachCostCents?: bigint; evidenceFreshnessHours?: number; startsAt: Date; endsAt: Date; audienceCriteria: Prisma.InputJsonValue; sourceRequirements: Prisma.InputJsonValue }) {
  if (!input.name.trim() || input.state.trim().length !== 2) throw new Error("Campaign name and two-letter state are required.");
  if (input.endsAt <= input.startsAt) throw new Error("Campaign end must follow its start.");
  return getPrisma().$transaction(async (tx) => {
    const campaign = await tx.acquisitionCampaign.create({ data: { name: input.name.trim(), jurisdictionState: input.state.toUpperCase(), type: input.type, status: "DRAFT", outboundEnabled: false, startsAt: input.startsAt, endsAt: input.endsAt } });
    await tx.acquisitionCampaignBoundary.create({ data: { campaignId: campaign.id, version: 1, allowedStates: [input.state.toUpperCase()], allowedCounties: list(input.counties ?? ""), allowedCities: list(input.cities ?? ""), allowedZipCodes: list(input.zipCodes ?? ""), allowedNeighborhoods: list(input.neighborhoods ?? ""), radiusCenterLatitude: input.radiusCenterLatitude, radiusCenterLongitude: input.radiusCenterLongitude, radiusMiles: input.radiusMiles, mapPolygon: input.mapPolygon, includedPropertyTypes: list(input.includedPropertyTypes ?? ""), excludedPropertyTypes: list(input.excludedPropertyTypes ?? ""), acquisitionStrategy: input.acquisitionStrategy, developmentFilters: input.developmentFilters, priceFilters: input.priceFilters, targetBuyerGroup: input.targetBuyerGroup, minimumRequiredProfitCents: input.minimumRequiredProfitCents, maximumEarnestMoneyCents: input.maximumEarnestMoneyCents, maximumResearchCostCents: input.maximumResearchCostCents, maximumOutreachCostCents: input.maximumOutreachCostCents, evidenceFreshnessHours: input.evidenceFreshnessHours, allowedChannels: [], audienceCriteria: input.audienceCriteria, sourceRequirements: input.sourceRequirements, doNotContactEnforced: true, consentRequired: true, maxRecipientsPerDay: 0, effectiveAt: input.startsAt, expiresAt: input.endsAt, createdBy: input.actor } });
    return campaign;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function recordAcquisitionGate(input: { funnelId: string; type: AcquisitionGateType; status: AcquisitionGateStatus; actor: string; sourceUrl?: string; expiresAt?: Date; evidence: Prisma.InputJsonValue }) {
  if (["SATISFIED", "WAIVED"].includes(input.status) && !input.sourceUrl) throw new Error("Satisfied or waived gates require attributable evidence.");
  return getPrisma().$transaction(async (tx) => {
    const latest = await tx.acquisitionGate.findFirst({ where: { funnelId: input.funnelId, type: input.type }, orderBy: { version: "desc" } });
    return tx.acquisitionGate.create({ data: { funnelId: input.funnelId, type: input.type, version: (latest?.version ?? 0) + 1, status: input.status, evidence: input.evidence, sourceUrl: input.sourceUrl ? httpsUrl(input.sourceUrl) : undefined, decidedBy: input.actor, decidedAt: new Date(), expiresAt: input.expiresAt } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function withStageRetry<T>(operation:()=>Promise<T>){for(let attempt=1;attempt<=3;attempt+=1){try{return await operation();}catch(error){const retryable=error instanceof Prisma.PrismaClientKnownRequestError&&["P2002","P2034"].includes(error.code);if(!retryable||attempt===3)throw error;}}throw new Error("Stage transition retry exhausted.");}

export async function advanceAcquisitionStage(input: { funnelId: string; nextStage: AcquisitionStage; actor: string; reason: string; entryEvidence?: StageCriterion[]; exitEvidence?: StageCriterion[]; approvalEvidence?: Prisma.InputJsonValue }) {
  if (input.reason.trim().length < 10) throw new Error("A meaningful stage-change reason is required.");
  const db=getPrisma(); return withStageRetry(()=>db.$transaction(async (tx) => {
    const funnel = await tx.acquisitionFunnel.findUnique({ where: { id: input.funnelId }, include: { transaction: true, gates: true } });
    if (!funnel) throw new Error("Acquisition funnel not found.");
    const terminal = ["DISQUALIFIED", "NURTURE", "ARCHIVED"].includes(input.nextStage);
    const policy=await tx.acquisitionStagePolicy.findFirst({where:{stage:input.nextStage,active:true,OR:[{effectiveAt:null},{effectiveAt:{lte:new Date()}}],AND:[{OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}]},orderBy:{version:"desc"}});
    if(!policy)return {advanced:false as const,blockers:["active_stage_policy_missing"]};
    const codes=(value:Prisma.JsonValue|null)=>Array.isArray(value)?value.flatMap(item=>typeof item==="object"&&item!==null&&"code" in item&&typeof item.code==="string"?[item.code]:[]):[];
    const criteria=evaluateStageCriteria({entry:input.entryEvidence??[],exit:input.exitEvidence??[],requiredEntryCodes:codes(policy.entryCriteria),requiredExitCodes:codes(policy.exitCriteria),terminal,approvalEvidence:input.approvalEvidence,now:new Date()});
    if(!criteria.allowed)return {advanced:false as const,blockers:criteria.blockers};
    const decision = terminal ? { allowed: funnel.transaction?.controlStatus !== "STOPPED", blockers: funnel.transaction?.controlStatus === "STOPPED" ? ["transaction_stopped"] : [] } : evaluateStageTransition({ currentStage: funnel.stage, nextStage: input.nextStage, gates: funnel.gates, transactionControlStatus: funnel.transaction?.controlStatus ?? "ON_HOLD", now: new Date() });
    if (!decision.allowed) return { advanced: false as const, blockers: decision.blockers };
    const latest = await tx.acquisitionStageHistory.findFirst({ where: { funnelId: funnel.id }, orderBy: { sequence: "desc" }, select: { sequence: true } });
    await tx.acquisitionStageHistory.updateMany({ where: { funnelId: funnel.id, exitedAt: null }, data: { exitedAt: new Date() } });
    await tx.acquisitionFunnel.update({ where: { id: funnel.id }, data: { stage: input.nextStage, stageEnteredAt: new Date(), lastActivityAt: new Date(), responsibleActor: input.actor, nextReviewAt: new Date(Date.now() + 7 * 86_400_000), expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
    await tx.acquisitionStageHistory.create({ data: { funnelId: funnel.id, sequence: (latest?.sequence ?? 0) + 1, fromStage: funnel.stage, toStage: input.nextStage, actor: input.actor, reason: input.reason.trim(), responsibleActor:input.actor, evidence: { policyId:policy.id,policyVersion:policy.version,entryEvidence:input.entryEvidence??[],exitEvidence:input.exitEvidence??[],gateVersions: funnel.gates.map((gate) => ({ type: gate.type, version: gate.version, status: gate.status })) },approvalEvidence:input.approvalEvidence } });
    return { advanced: true as const, blockers: [] };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export const __operatingLayerTestables={withStageRetry};
