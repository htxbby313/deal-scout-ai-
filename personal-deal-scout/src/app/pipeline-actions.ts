"use server";

import { revalidatePath } from "next/cache";
import type { AcquisitionGateStatus, AcquisitionGateType, AcquisitionStage } from "@prisma/client";
import { requireOwner } from "@/lib/auth";
import { advanceAcquisitionStage, createBuyerDemandRecord, createCampaignRecord, recordAcquisitionGate } from "@/lib/operating-layer";
import { recordBuyerPropertyPrice } from "@/lib/buyer-demand-service";

export type PipelineActionState = { status: "idle" | "success" | "error"; message: string };
const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const cents = (data: FormData, key: string) => { const raw = text(data, key); return raw ? BigInt(Math.round(Number(raw) * 100)) : undefined; };
const date = (data: FormData, key: string) => { const result = new Date(text(data, key)); if (Number.isNaN(result.getTime())) throw new Error(`${key} requires a valid date.`); return result; };
const number = (data: FormData, key: string) => { const raw = text(data, key); if (!raw) return undefined; const result = Number(raw); if (!Number.isFinite(result)) throw new Error(`${key} requires a number.`); return result; };
const result = async (work: () => Promise<unknown>, message: string): Promise<PipelineActionState> => { try { await work(); revalidatePath("/pipeline"); return { status: "success", message }; } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "The operation could not be completed." }; } };

export async function createBuyerDemandAction(_state: PipelineActionState, data: FormData) {
  await requireOwner();
  return result(() => createBuyerDemandRecord({ developerId: text(data, "developerId"), actor: "owner", states: text(data, "states"), counties: text(data, "counties"), zipCodes: text(data, "zipCodes"), assetTypes: text(data, "assetTypes"), excludedAreas: text(data, "excludedAreas"), minPurchasePriceCents: cents(data, "minPurchasePrice"), maxPurchasePriceCents: cents(data, "maxPurchasePrice"), minCompletedValueCents: cents(data, "minCompletedValue"), maxCompletedValueCents: cents(data, "maxCompletedValue"), minAcres: number(data, "minAcres"), maxAcres: number(data, "maxAcres"), minLotWidthFeet: number(data, "minLotWidthFeet"), minLotDepthFeet: number(data, "minLotDepthFeet"), minFrontageFeet: number(data, "minFrontageFeet"), accessPreferences: text(data, "accessPreferences"), utilityPreferences: text(data, "utilityPreferences"), zoningPreferences: text(data, "zoningPreferences"), floodPreferences: text(data, "floodPreferences"), entitlementPreferences: text(data, "entitlementPreferences"), redevelopmentPreferences: text(data, "redevelopmentPreferences"), requiredClosingDays: number(data, "requiredClosingDays"), assignmentAcceptance: text(data, "assignmentAcceptance"), doubleCloseAcceptance: text(data, "doubleCloseAcceptance"), earnestMoneyExpectationCents: cents(data, "earnestMoneyExpectation"), inspectionRequirements: text(data, "inspectionRequirements"), decisionMakerName: text(data, "decisionMakerName"), approvedChannel: (text(data, "approvedChannel") || undefined) as "EMAIL" | "SMS" | "PHONE" | "MAIL" | "INTERNAL" | undefined, currentBuyingStatus: text(data, "currentBuyingStatus"), criteriaConfirmedAt: date(data, "criteriaConfirmedAt"), maxAssignmentFeeCents: cents(data, "maxAssignmentFee"), strategy: [text(data, "strategy"), text(data, "notes")].filter(Boolean).join(" — ") || undefined, sourceUrl: text(data, "sourceUrl"), expiresAt: date(data, "expiresAt") }), "Versioned buyer criteria saved as a draft pending verification.");
}

export async function recordBuyerPriceAction(_state: PipelineActionState, data: FormData) { await requireOwner(); return result(() => recordBuyerPropertyPrice({ developerId: text(data, "developerId"), demandVersionId: text(data, "demandVersionId"), funnelId: text(data, "funnelId"), status: text(data, "status") as "INDICATIVE" | "CONDITIONAL" | "DOCUMENTED" | "COMMITTED" | "EXPIRED", lowCents: cents(data, "low") ?? BigInt(-1), baseCents: cents(data, "base") ?? BigInt(-1), highCents: cents(data, "high") ?? BigInt(-1), assumptions: text(data, "assumptions").split(",").map((item) => item.trim()).filter(Boolean), sourceUrl: text(data, "sourceUrl"), observedAt: date(data, "observedAt"), expiresAt: date(data, "expiresAt"), reviewer: "owner", reviewedAt: new Date() }), "Property-specific buyer pricing recorded with evidence and expiry."); }

export async function createCampaignAction(_state: PipelineActionState, data: FormData) {
  await requireOwner();
  return result(() => createCampaignRecord({ name: text(data, "name"), state: text(data, "state"), type: text(data, "type") as "SELLER_ACQUISITION" | "BUYER_DISPOSITION", actor: "owner", startsAt: date(data, "startsAt"), endsAt: date(data, "endsAt"), audienceCriteria: { description: text(data, "audienceCriteria") }, sourceRequirements: { description: text(data, "sourceRequirements") } }), "Campaign boundary saved in draft with outbound disabled.");
}

export async function recordGateAction(_state: PipelineActionState, data: FormData) {
  await requireOwner();
  return result(() => recordAcquisitionGate({ funnelId: text(data, "funnelId"), type: text(data, "type") as AcquisitionGateType, status: text(data, "status") as AcquisitionGateStatus, actor: "owner", sourceUrl: text(data, "sourceUrl") || undefined, expiresAt: text(data, "expiresAt") ? date(data, "expiresAt") : undefined, evidence: { notes: text(data, "evidence") } }), "Versioned gate decision recorded.");
}

export async function advanceStageAction(_state: PipelineActionState, data: FormData) {
  await requireOwner();
  return result(async () => { const decision = await advanceAcquisitionStage({ funnelId: text(data, "funnelId"), nextStage: text(data, "nextStage") as AcquisitionStage, actor: "owner", reason: text(data, "reason") }); if (!decision.advanced) throw new Error(`Stage blocked: ${decision.blockers.join(", ")}`); }, "Opportunity advanced with its evidence snapshot.");
}
