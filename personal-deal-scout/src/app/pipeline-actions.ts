"use server";

import { revalidatePath } from "next/cache";
import type { AcquisitionGateStatus, AcquisitionGateType, AcquisitionStage } from "@prisma/client";
import { requireOwner } from "@/lib/auth";
import { advanceAcquisitionStage, createBuyerDemandRecord, createCampaignRecord, recordAcquisitionGate } from "@/lib/operating-layer";

export type PipelineActionState = { status: "idle" | "success" | "error"; message: string };
const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const cents = (data: FormData, key: string) => { const raw = text(data, key); return raw ? BigInt(Math.round(Number(raw) * 100)) : undefined; };
const date = (data: FormData, key: string) => { const result = new Date(text(data, key)); if (Number.isNaN(result.getTime())) throw new Error(`${key} requires a valid date.`); return result; };
const result = async (work: () => Promise<unknown>, message: string): Promise<PipelineActionState> => { try { await work(); revalidatePath("/pipeline"); return { status: "success", message }; } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "The operation could not be completed." }; } };

export async function createBuyerDemandAction(_state: PipelineActionState, data: FormData) {
  await requireOwner();
  return result(() => createBuyerDemandRecord({ developerId: text(data, "developerId"), actor: "owner", states: text(data, "states"), counties: text(data, "counties"), zipCodes: text(data, "zipCodes"), assetTypes: text(data, "assetTypes"), minPurchasePriceCents: cents(data, "minPurchasePrice"), maxPurchasePriceCents: cents(data, "maxPurchasePrice"), maxAssignmentFeeCents: cents(data, "maxAssignmentFee"), strategy: [text(data, "strategy"), text(data, "notes")].filter(Boolean).join(" — ") || undefined, sourceUrl: text(data, "sourceUrl"), expiresAt: date(data, "expiresAt") }), "Versioned buyer criteria saved as a draft pending verification.");
}

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
