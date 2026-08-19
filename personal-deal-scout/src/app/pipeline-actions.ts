"use server";

import { revalidatePath } from "next/cache";
import {
  Prisma,
  type AcquisitionGateStatus,
  AcquisitionGateType,
  AcquisitionStage,
} from "@prisma/client";
import { requireOwner } from "@/lib/auth";
import type{StageCriterion}from"@/lib/stage-criteria";
import{parseMoneyToCents}from"@/lib/financial-truth";
import {
  advanceAcquisitionStage,
  createBuyerDemandRecord,
  createCampaignRecord,
  recordAcquisitionGate,
} from "@/lib/operating-layer";
import {
  confirmBuyerCoverage,
  recordBuyerPropertyPrice,
} from "@/lib/buyer-demand-service";
import {
  activateProfitPriorityConfiguration,
  createProfitPriorityConfiguration,
} from "@/lib/profit-priority-service";
import { activateStagePolicy, createStagePolicy } from "@/lib/funnel-automation";

export type PipelineActionState = {
  status: "idle" | "success" | "error";
  message: string;
};
const text = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const cents = (data: FormData, key: string) => {
  const raw = text(data, key);
  return raw ? parseMoneyToCents(raw) : undefined;
};
const date = (data: FormData, key: string) => {
  const result = new Date(text(data, key));
  if (Number.isNaN(result.getTime()))
    throw new Error(`${key} requires a valid date.`);
  return result;
};
const number = (data: FormData, key: string) => {
  const raw = text(data, key);
  if (!raw) return undefined;
  const result = Number(raw);
  if (!Number.isFinite(result)) throw new Error(`${key} requires a number.`);
  return result;
};
const json = (data: FormData, key: string) => {
  const raw = text(data, key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Prisma.InputJsonValue;
  } catch {
    throw new Error(`${key} requires valid JSON.`);
  }
};
const result = async (
  work: () => Promise<unknown>,
  message: string,
): Promise<PipelineActionState> => {
  try {
    await work();
    revalidatePath("/pipeline");
    return { status: "success", message };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The operation could not be completed.",
    };
  }
};

export async function createStagePolicyAction(_state: PipelineActionState, data: FormData) {
  await requireOwner();
  return result(() => createStagePolicy({ stage: text(data, "stage") as AcquisitionStage, reviewIntervalHours: number(data, "reviewIntervalHours") ?? 0, expiryAction: text(data, "expiryAction") as "REFRESH_RESEARCH" | "MANUAL_VERIFICATION" | "NURTURE" | "DISQUALIFY" | "ARCHIVE", requiredGateTypes: text(data, "requiredGateTypes").split(",").map((item) => item.trim()).filter(Boolean) as AcquisitionGateType[], entryCriteria: json(data, "entryCriteria") ?? [], exitCriteria: json(data, "exitCriteria") ?? [], highValueThresholdCents: cents(data, "highValueThreshold"), reason: text(data, "reason"), actor: "owner", effectiveAt: text(data, "effectiveAt") ? date(data, "effectiveAt") : undefined, expiresAt: text(data, "expiresAt") ? date(data, "expiresAt") : undefined }), "Stage policy saved as an inactive version pending owner activation.");
}

export async function activateStagePolicyAction(_state: PipelineActionState, data: FormData) {
  await requireOwner();
  return result(() => activateStagePolicy({ policyId: text(data, "policyId"), actor: "owner", reason: text(data, "reason") }), "Stage policy activated and the prior active version retired.");
}

export async function createBuyerDemandAction(
  _state: PipelineActionState,
  data: FormData,
) {
  await requireOwner();
  return result(
    () =>
      createBuyerDemandRecord({
        developerId: text(data, "developerId"),
        actor: "owner",
        states: text(data, "states"),
        counties: text(data, "counties"),
        zipCodes: text(data, "zipCodes"),
        assetTypes: text(data, "assetTypes"),
        excludedAreas: text(data, "excludedAreas"),
        minPurchasePriceCents: cents(data, "minPurchasePrice"),
        maxPurchasePriceCents: cents(data, "maxPurchasePrice"),
        minCompletedValueCents: cents(data, "minCompletedValue"),
        maxCompletedValueCents: cents(data, "maxCompletedValue"),
        minAcres: number(data, "minAcres"),
        maxAcres: number(data, "maxAcres"),
        minLotWidthFeet: number(data, "minLotWidthFeet"),
        minLotDepthFeet: number(data, "minLotDepthFeet"),
        minFrontageFeet: number(data, "minFrontageFeet"),
        accessPreferences: text(data, "accessPreferences"),
        utilityPreferences: text(data, "utilityPreferences"),
        zoningPreferences: text(data, "zoningPreferences"),
        floodPreferences: text(data, "floodPreferences"),
        entitlementPreferences: text(data, "entitlementPreferences"),
        redevelopmentPreferences: text(data, "redevelopmentPreferences"),
        requiredClosingDays: number(data, "requiredClosingDays"),
        assignmentAcceptance: text(data, "assignmentAcceptance"),
        doubleCloseAcceptance: text(data, "doubleCloseAcceptance"),
        earnestMoneyExpectationCents: cents(data, "earnestMoneyExpectation"),
        inspectionRequirements: text(data, "inspectionRequirements"),
        decisionMakerName: text(data, "decisionMakerName"),
        approvedChannel: (text(data, "approvedChannel") || undefined) as
          "EMAIL" | "SMS" | "PHONE" | "MAIL" | "INTERNAL" | undefined,
        currentBuyingStatus: text(data, "currentBuyingStatus"),
        criteriaConfirmedAt: date(data, "criteriaConfirmedAt"),
        maxAssignmentFeeCents: cents(data, "maxAssignmentFee"),
        strategy:
          [text(data, "strategy"), text(data, "notes")]
            .filter(Boolean)
            .join(" — ") || undefined,
        sourceUrl: text(data, "sourceUrl"),
        expiresAt: date(data, "expiresAt"),
      }),
    "Versioned buyer criteria saved as a draft pending verification.",
  );
}

export async function recordBuyerPriceAction(
  _state: PipelineActionState,
  data: FormData,
) {
  await requireOwner();
  return result(
    () =>
      recordBuyerPropertyPrice({
        developerId: text(data, "developerId"),
        demandVersionId: text(data, "demandVersionId"),
        funnelId: text(data, "funnelId"),
        status: text(data, "status") as
          "INDICATIVE" | "CONDITIONAL" | "DOCUMENTED" | "COMMITTED" | "EXPIRED",
        lowCents: cents(data, "low") ?? BigInt(-1),
        baseCents: cents(data, "base") ?? BigInt(-1),
        highCents: cents(data, "high") ?? BigInt(-1),
        assumptions: text(data, "assumptions")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        sourceUrl: text(data, "sourceUrl"),
        observedAt: date(data, "observedAt"),
        expiresAt: date(data, "expiresAt"),
        reviewer: "owner",
        reviewedAt: new Date(),
      }),
    "Property-specific buyer pricing recorded with evidence and expiry.",
  );
}

export async function confirmBuyerCoverageAction(
  _state: PipelineActionState,
  data: FormData,
) {
  await requireOwner();
  return result(
    () =>
      confirmBuyerCoverage({
        funnelId: text(data, "funnelId"),
        demandVersionId: text(data, "demandVersionId"),
        role: text(data, "role") as "PRIMARY" | "BACKUP",
        matchScore: number(data, "matchScore") ?? -1,
        reasons: text(data, "reasons")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        expiresAt: date(data, "expiresAt"),
        actor: "owner",
      }),
    "Buyer coverage confirmed from cross-checked demand, pricing, capacity, reliability, and permission evidence.",
  );
}

export async function createProfitPriorityConfigurationAction(
  _state: PipelineActionState,
  data: FormData,
) {
  await requireOwner();
  return result(
    () =>
      createProfitPriorityConfiguration({
        weights: {
          projectedProfit: number(data, "projectedProfitWeight") ?? -1,
          probability: number(data, "probabilityWeight") ?? -1,
          sellerFit: number(data, "sellerFitWeight") ?? -1,
          evidence: number(data, "evidenceWeight") ?? -1,
          buyerCoverage: number(data, "buyerCoverageWeight") ?? -1,
          velocity: number(data, "velocityWeight") ?? -1,
          riskPenalty: number(data, "riskPenaltyWeight") ?? -1,
        },
        reason: text(data, "reason"),
        actor: "owner",
        effectiveAt: date(data, "effectiveAt"),
        expiresAt: text(data, "expiresAt")
          ? date(data, "expiresAt")
          : undefined,
      }),
    "Profit-priority configuration saved as a draft. Activation remains a separate owner decision.",
  );
}

export async function activateProfitPriorityConfigurationAction(
  _state: PipelineActionState,
  data: FormData,
) {
  await requireOwner();
  return result(
    () =>
      activateProfitPriorityConfiguration({
        configurationId: text(data, "configurationId"),
        actor: "owner",
      }),
    "Profit-priority configuration activated and the prior version retired.",
  );
}

export async function createCampaignAction(
  _state: PipelineActionState,
  data: FormData,
) {
  await requireOwner();
  return result(
    () =>
      createCampaignRecord({
        name: text(data, "name"),
        state: text(data, "state"),
        type: text(data, "type") as "SELLER_ACQUISITION" | "BUYER_DISPOSITION",
        actor: "owner",
        counties: text(data, "counties"),
        cities: text(data, "cities"),
        zipCodes: text(data, "zipCodes"),
        neighborhoods: text(data, "neighborhoods"),
        radiusCenterLatitude: number(data, "radiusCenterLatitude"),
        radiusCenterLongitude: number(data, "radiusCenterLongitude"),
        radiusMiles: number(data, "radiusMiles"),
        mapPolygon: json(data, "mapPolygon"),
        includedPropertyTypes: text(data, "includedPropertyTypes"),
        excludedPropertyTypes: text(data, "excludedPropertyTypes"),
        acquisitionStrategy: text(data, "acquisitionStrategy"),
        developmentFilters: json(data, "developmentFilters"),
        priceFilters: json(data, "priceFilters"),
        targetBuyerGroup: text(data, "targetBuyerGroup"),
        minimumRequiredProfitCents: cents(data, "minimumRequiredProfit"),
        maximumEarnestMoneyCents: cents(data, "maximumEarnestMoney"),
        maximumResearchCostCents: cents(data, "maximumResearchCost"),
        maximumOutreachCostCents: cents(data, "maximumOutreachCost"),
        evidenceFreshnessHours: number(data, "evidenceFreshnessHours"),
        startsAt: date(data, "startsAt"),
        endsAt: date(data, "endsAt"),
        audienceCriteria: { description: text(data, "audienceCriteria") },
        sourceRequirements: { description: text(data, "sourceRequirements") },
      }),
    "Campaign boundary saved in draft with outbound disabled.",
  );
}

export async function recordGateAction(
  _state: PipelineActionState,
  data: FormData,
) {
  await requireOwner();
  return result(
    () =>
      recordAcquisitionGate({
        funnelId: text(data, "funnelId"),
        type: text(data, "type") as AcquisitionGateType,
        status: text(data, "status") as AcquisitionGateStatus,
        actor: "owner",
        sourceUrl: text(data, "sourceUrl") || undefined,
        expiresAt: text(data, "expiresAt")
          ? date(data, "expiresAt")
          : undefined,
        evidence: { notes: text(data, "evidence") },
      }),
    "Versioned gate decision recorded.",
  );
}

export async function advanceStageAction(
  _state: PipelineActionState,
  data: FormData,
) {
  await requireOwner();
  return result(async () => {
    const criteria=(key:string)=>{const parsed=json(data,key);if(!Array.isArray(parsed))throw new Error(`${key} requires a JSON array.`);return parsed as unknown as StageCriterion[];};
    const decision = await advanceAcquisitionStage({
      funnelId: text(data, "funnelId"),
      nextStage: text(data, "nextStage") as AcquisitionStage,
      actor: "owner",
      reason: text(data, "reason"),
      entryEvidence:criteria("entryEvidence"),exitEvidence:criteria("exitEvidence"),approvalEvidence:text(data,"terminalOwnerApproval")==="approved"?{approvedBy:"owner",approvedAt:new Date().toISOString()}:undefined,
    });
    if (!decision.advanced)
      throw new Error(`Stage blocked: ${decision.blockers.join(", ")}`);
  }, "Opportunity advanced with its evidence snapshot.");
}
