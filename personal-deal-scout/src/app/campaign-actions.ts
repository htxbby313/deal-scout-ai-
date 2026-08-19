"use server";
import { revalidatePath } from "next/cache";
import type { CampaignCostType } from "@prisma/client";
import { requireOwner } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/financial-truth";
import {
  activateCampaign,
  approveCampaign,
  assignCampaignAgent,
  assignCampaignOpportunity,
  createCampaignGoalVersion,
  pauseCampaign,
  recordCampaignCost,
} from "@/lib/campaign-service";
const text = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const date = (d: FormData, k: string) => new Date(text(d, k));
const number = (d: FormData, k: string) =>
  text(d, k) ? Number(text(d, k)) : undefined;
const money = (d: FormData, k: string) =>
  text(d, k) ? parseMoneyToCents(text(d, k)) : undefined;
export async function assignCampaignOpportunityAction(data: FormData) {
  await requireOwner();
  await assignCampaignOpportunity({
    campaignId: text(data, "campaignId"),
    funnelId: text(data, "funnelId"),
    reason: text(data, "reason"),
  });
  revalidatePath("/campaigns");
}
export async function assignCampaignAgentAction(data: FormData) {
  await requireOwner();
  await assignCampaignAgent({
    campaignId: text(data, "campaignId"),
    agentId: text(data, "agentId"),
    responsibility: text(data, "responsibility"),
    actor: "owner",
  });
  revalidatePath("/campaigns");
}
export async function recordCampaignCostAction(data: FormData) {
  await requireOwner();
  await recordCampaignCost({
    campaignId: text(data, "campaignId"),
    funnelId: text(data, "funnelId") || undefined,
    type: text(data, "type") as CampaignCostType,
    amountCents: money(data, "amount") ?? BigInt(-1),
    incurredAt: date(data, "incurredAt"),
    sourceUrl: text(data, "sourceUrl"),
    artifactHash: text(data, "artifactHash") || undefined,
    description: text(data, "description"),
    actor: "owner",
  });
  revalidatePath("/campaigns");
}
export async function createCampaignGoalAction(data: FormData) {
  await requireOwner();
  await createCampaignGoalVersion({
    campaignId: text(data, "campaignId"),
    discoveredTarget: number(data, "discoveredTarget"),
    researchedTarget: number(data, "researchedTarget"),
    sellerContactTarget: number(data, "sellerContactTarget"),
    offerTarget: number(data, "offerTarget"),
    contractTarget: number(data, "contractTarget"),
    closeTarget: number(data, "closeTarget"),
    realizedProfitTargetCents: money(data, "realizedProfitTarget"),
    effectiveAt: date(data, "effectiveAt"),
    expiresAt: text(data, "expiresAt") ? date(data, "expiresAt") : undefined,
    actor: "owner",
  });
  revalidatePath("/campaigns");
}
export async function approveCampaignAction(data: FormData) {
  await requireOwner();
  await approveCampaign({
    campaignId: text(data, "campaignId"),
    actor: "owner",
  });
  revalidatePath("/campaigns");
  revalidatePath("/pipeline");
}
export async function activateCampaignAction(data: FormData) {
  await requireOwner();
  await activateCampaign({
    campaignId: text(data, "campaignId"),
    actor: "owner",
  });
  revalidatePath("/campaigns");
  revalidatePath("/pipeline");
}
export async function pauseCampaignAction(data: FormData) {
  await requireOwner();
  await pauseCampaign({ campaignId: text(data, "campaignId"), actor: "owner" });
  revalidatePath("/campaigns");
  revalidatePath("/pipeline");
}
