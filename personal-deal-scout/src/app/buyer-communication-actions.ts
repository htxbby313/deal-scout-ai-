"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export type BuyerCommunicationState = { status: "idle" | "success" | "error"; message: string };

export async function setBuyerCommunicationsAction(developerId: string, enabled: boolean, _state: BuyerCommunicationState): Promise<BuyerCommunicationState> {
  void _state;
  await requireOwner();
  try {
    const db = getPrisma();
    const buyer = await db.developer.update({ where: { id: developerId }, data: { communicationsEnabled: enabled } });
    await db.auditLog.create({ data: { type: "buyer.communications.changed", summary: `${buyer.companyName} communications ${enabled ? "allowed" : "paused"}.`, details: { developerId, enabled, actor: "owner" } } });
    revalidatePath("/developers");
    return { status: "success", message: enabled ? "Buyer communications allowed." : "Buyer communications paused." };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Communication setting could not be saved." };
  }
}

export async function recordBuyerResponseAction(developerId: string, _state: BuyerCommunicationState, data: FormData): Promise<BuyerCommunicationState> {
  await requireOwner();
  const summary = String(data.get("summary") ?? "").trim();
  const channel = String(data.get("channel") ?? "EMAIL").trim();
  if (summary.length < 3) return { status: "error", message: "Add the buyer's response." };
  try {
    const db = getPrisma();
    const buyer = await db.developer.findUniqueOrThrow({ where: { id: developerId }, select: { companyName: true } });
    await db.$transaction([
      db.buyerConversation.create({ data: { developerId, direction: "INBOUND", channel, summary, occurredAt: new Date(), recordedBy: "owner" } }),
      db.auditLog.create({ data: { type: "buyer.response.recorded", summary: `Recorded a response from ${buyer.companyName}.`, details: { developerId, channel, actor: "owner" } } }),
    ]);
    revalidatePath("/developers");
    return { status: "success", message: "Response added to this buyer relationship." };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Response could not be recorded." };
  }
}
