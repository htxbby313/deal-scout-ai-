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
export async function createSellerEngagementAction(data: FormData) {
  await requireOwner();
  await createSellerEngagementDraft({
    transactionId: text(data, "transactionId"),
    channel: channel(data, "channel"),
    recipient: text(data, "recipient"),
    recipientLabel: text(data, "recipientLabel"),
    purpose: text(data, "purpose"),
    actor: "owner",
  });
  revalidatePath("/seller-crm");
}
export async function reviewSellerEngagementAction(data: FormData) {
  await requireOwner();
  await reviewSellerEngagementDraft({
    engagementId: text(data, "engagementId"),
    approved: text(data, "decision") === "approve",
    actor: "owner",
  });
  revalidatePath("/owner-queue");
  revalidatePath("/seller-crm");
}
export async function recordSellerConversationAction(data: FormData) {
  await requireOwner();
  await recordSellerConversation({
    engagementId: text(data, "engagementId"),
    occurredAt: date(data, "occurredAt"),
    sourceType: text(data, "sourceType"),
    sourceUrl: text(data, "sourceUrl") || undefined,
    sourceArtifactHash: text(data, "sourceArtifactHash") || undefined,
    summary: text(data, "summary"),
    objections: parseLines(text(data, "objections")),
    questions: parseLines(text(data, "questions")),
    actor: "owner",
  });
  revalidatePath("/seller-crm");
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
  revalidatePath("/seller-crm");
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
  revalidatePath("/seller-crm");
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
  revalidatePath("/seller-crm");
}
