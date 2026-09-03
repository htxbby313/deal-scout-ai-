"use server";
import { revalidatePath } from "next/cache";
import type {
  EngagementChannel,
  SellerAuthorityStatus,
  SellerDispositionReason,
  SellerRepresentationStatus,
} from "@prisma/client";
import { requireOwner } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/financial-truth";
import { getPrisma } from "@/lib/prisma";
import {
  createSellerEngagementDraft,
  reviewSellerEngagementDraft,
} from "@/lib/seller-engagement";
import {
  recordSellerConversation,
  recordSellerDisposition,
  recordSellerFacts,
  scheduleSellerFollowUp,
} from "@/lib/seller-crm";
import {
  engagementChannels,
  parseEnumValue,
  parseLines,
  sellerAuthorityStatuses,
  sellerDispositionReasons,
  sellerRepresentationStatuses,
} from "@/lib/seller-crm-domain";
import { createControlledTransaction } from "@/lib/transaction-control";
const text = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
const date = (data: FormData, key: string) => {
  const value = new Date(text(data, key));
  if (Number.isNaN(value.getTime())) throw new Error(`${key} requires a date.`);
  return value;
};
const list = (data: FormData, key: string) =>
  text(data, key)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const money = (data: FormData, key: string) =>
  text(data, key) ? parseMoneyToCents(text(data, key)) : undefined;
const channel = (data: FormData, key: string) =>
  parseEnumValue(
    text(data, key),
    engagementChannels,
    "Channel",
  ) as EngagementChannel;

async function revalidateSellerSurfaces(input: {
  propertyId?: string;
  engagementId?: string;
  transactionId?: string;
}) {
  revalidatePath("/seller-crm");
  const known = input.propertyId?.trim();
  if (known) {
    revalidatePath(`/deals/${known}`);
    return;
  }
  const db = getPrisma();
  if (input.engagementId?.trim()) {
    const row = await db.sellerEngagement.findUnique({
      where: { id: input.engagementId.trim() },
      select: { transaction: { select: { propertyId: true } } },
    });
    if (row?.transaction.propertyId) {
      revalidatePath(`/deals/${row.transaction.propertyId}`);
    }
    return;
  }
  if (input.transactionId?.trim()) {
    const row = await db.dealTransaction.findUnique({
      where: { id: input.transactionId.trim() },
      select: { propertyId: true },
    });
    if (row?.propertyId) {
      revalidatePath(`/deals/${row.propertyId}`);
    }
  }
}

export async function createSellerEngagementAction(data: FormData) {
  await requireOwner();
  const transactionId = text(data, "transactionId");
  await createSellerEngagementDraft({
    transactionId,
    channel: channel(data, "channel"),
    recipient: text(data, "recipient"),
    recipientLabel: text(data, "recipientLabel"),
    purpose: text(data, "purpose"),
    actor: "owner",
  });
  await revalidateSellerSurfaces({
    propertyId: text(data, "propertyId"),
    transactionId,
  });
}

export async function startSellerThreadOnDealAction(data: FormData) {
  await requireOwner();
  const propertyId = text(data, "propertyId");
  if (!propertyId) throw new Error("propertyId is required.");
  let transactionId = text(data, "transactionId");
  if (!transactionId) {
    const transaction = await createControlledTransaction({
      propertyId,
      actor: "owner",
    });
    transactionId = transaction.id;
  }
  await createSellerEngagementDraft({
    transactionId,
    channel: channel(data, "channel"),
    recipient: text(data, "recipient"),
    recipientLabel: text(data, "recipientLabel"),
    purpose: text(data, "purpose") || "Seller relationship for this deal",
    actor: "owner",
  });
  revalidatePath("/seller-crm");
  revalidatePath(`/deals/${propertyId}`);
}

export async function reviewSellerEngagementAction(data: FormData) {
  await requireOwner();
  const engagementId = text(data, "engagementId");
  await reviewSellerEngagementDraft({
    engagementId,
    approved: text(data, "decision") === "approve",
    actor: "owner",
  });
  revalidatePath("/owner-queue");
  await revalidateSellerSurfaces({
    propertyId: text(data, "propertyId"),
    engagementId,
  });
}
export async function recordSellerConversationAction(data: FormData) {
  await requireOwner();
  const engagementId = text(data, "engagementId");
  await recordSellerConversation({
    engagementId,
    occurredAt: date(data, "occurredAt"),
    sourceType: text(data, "sourceType"),
    sourceUrl: text(data, "sourceUrl") || undefined,
    sourceArtifactHash: text(data, "sourceArtifactHash") || undefined,
    summary: text(data, "summary"),
    objections: parseLines(text(data, "objections")),
    questions: parseLines(text(data, "questions")),
    actor: "owner",
  });
  await revalidateSellerSurfaces({
    propertyId: text(data, "propertyId"),
    engagementId,
  });
}
export async function recordSellerFactsAction(data: FormData) {
  await requireOwner();
  const preferredChannel = text(data, "preferredChannel");
  await recordSellerFacts({
    engagementId: text(data, "engagementId"),
    conversationId: text(data, "conversationId"),
    priorities: list(data, "priorities"),
    timeline: text(data, "timeline") || undefined,
    propertyCondition: text(data, "propertyCondition") || undefined,
    desiredProceedsCents: money(data, "desiredProceeds"),
    minimumNetProceedsCents: money(data, "minimumNetProceeds"),
    authorityStatus: parseEnumValue(
      text(data, "authorityStatus"),
      sellerAuthorityStatuses,
      "Authority status",
    ) as SellerAuthorityStatus,
    authoritySourceUrl: text(data, "authoritySourceUrl") || undefined,
    representationStatus: parseEnumValue(
      text(data, "representationStatus"),
      sellerRepresentationStatuses,
      "Representation status",
    ) as SellerRepresentationStatus,
    preferredChannel: preferredChannel
      ? (parseEnumValue(
          preferredChannel,
          engagementChannels,
          "Preferred channel",
        ) as EngagementChannel)
      : undefined,
    independentAdviceOfferedAt: text(data, "independentAdviceOfferedAt")
      ? date(data, "independentAdviceOfferedAt")
      : undefined,
    sellerStatedAt: date(data, "sellerStatedAt"),
    correctionReason: text(data, "correctionReason") || undefined,
    independentAdviceRequired: data.get("independentAdviceRequired") === "on",
    actor: "owner",
  });
  await revalidateSellerSurfaces({
    propertyId: text(data, "propertyId"),
    engagementId: text(data, "engagementId"),
  });
}
export type SellerFactsFormState = {
  status: "idle" | "error" | "success";
  message: string;
};
export async function recordSellerFactsFormAction(
  _previous: SellerFactsFormState,
  data: FormData,
): Promise<SellerFactsFormState> {
  try {
    await recordSellerFactsAction(data);
    return { status: "success", message: "Seller facts saved." };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Seller facts could not be saved.",
    };
  }
}
export async function scheduleSellerFollowUpAction(data: FormData) {
  await requireOwner();
  const rawChannel = text(data, "channel");
  await scheduleSellerFollowUp({
    engagementId: text(data, "engagementId"),
    dueAt: date(data, "dueAt"),
    reason: text(data, "reason"),
    channel: rawChannel
      ? (parseEnumValue(
          rawChannel,
          engagementChannels,
          "Channel",
        ) as EngagementChannel)
      : undefined,
    actor: "owner",
  });
  await revalidateSellerSurfaces({
    propertyId: text(data, "propertyId"),
    engagementId: text(data, "engagementId"),
  });
}
export async function recordSellerDispositionAction(data: FormData) {
  await requireOwner();
  await recordSellerDisposition({
    engagementId: text(data, "engagementId"),
    reason: parseEnumValue(
      text(data, "reason"),
      sellerDispositionReasons,
      "Disposition reason",
    ) as SellerDispositionReason,
    explanation: text(data, "explanation") || undefined,
    nurtureUntil: text(data, "nurtureUntil")
      ? date(data, "nurtureUntil")
      : undefined,
    actor: "owner",
  });
  await revalidateSellerSurfaces({
    propertyId: text(data, "propertyId"),
    engagementId: text(data, "engagementId"),
  });
}
