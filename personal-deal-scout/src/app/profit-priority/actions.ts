"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import {
  activateProfitPriorityConfiguration,
  createProfitPriorityConfiguration,
} from "@/lib/profit-priority-service";
const text = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const value = (data: FormData, key: string) => Number(text(data, key));
export async function createConfigurationAction(data: FormData) {
  await requireOwner();
  await createProfitPriorityConfiguration({
    weights: {
      projectedProfit: value(data, "projectedProfit"),
      probability: value(data, "probability"),
      sellerFit: value(data, "sellerFit"),
      evidence: value(data, "evidence"),
      buyerCoverage: value(data, "buyerCoverage"),
      velocity: value(data, "velocity"),
      riskPenalty: value(data, "riskPenalty"),
    },
    reason: text(data, "reason"),
    actor: "owner",
    effectiveAt: new Date(text(data, "effectiveAt")),
    expiresAt: text(data, "expiresAt")
      ? new Date(text(data, "expiresAt"))
      : undefined,
  });
  revalidatePath("/profit-priority");
}
export async function activateConfigurationAction(data: FormData) {
  await requireOwner();
  await activateProfitPriorityConfiguration({
    configurationId: text(data, "configurationId"),
    actor: "owner",
  });
  revalidatePath("/profit-priority");
  revalidatePath("/pipeline");
}
