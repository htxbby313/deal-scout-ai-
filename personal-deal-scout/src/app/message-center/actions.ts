"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { attemptProviderSend } from "@/lib/database";
import {
  buyerIntroduction,
  propertyPackageInquiry,
  sellerIntroduction,
} from "@/lib/conversation-voice";
import {
  defaultPathwayTemplates,
  isConversationPathwayId,
  type ConversationPathwayId,
} from "@/lib/conversation-pathways";

function text(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

function pathwayType(pathway: string): ConversationPathwayId {
  if (!isConversationPathwayId(pathway)) throw new Error("Unknown messaging pathway.");
  return pathway;
}

function pathwayFromApproval(subject?: string | null): ConversationPathwayId {
  return subject?.startsWith("Acquisitions relationship:")
    ? "DEVELOPER_BUYER_ACQUISITION"
    : "SELLER_ACQUISITION";
}

function applyTemplate(
  template: string,
  context: Record<string, string | null | undefined>,
) {
  return template.replace(/\[([A-Z_]+)\]/g, (_, key: string) => context[key] ?? `[${key}]`);
}

export async function saveMessageAction(formData: FormData) {
  await requireOwner();
  const id = text(formData, "approvalId");
  const body = text(formData, "body");
  if (!id || body.length < 2) throw new Error("Message text is required.");

  await getPrisma().messageApproval.update({
    where: { id },
    data: {
      body,
      status: "PENDING",
      blockerCodes: [],
    },
  });
  revalidatePath("/message-center");
  revalidatePath("/seller-crm");
}

export async function sendMessageAction(formData: FormData) {
  await requireOwner();
  const id = text(formData, "approvalId");
  if (!id) throw new Error("Message is required.");
  await attemptProviderSend(id);
  revalidatePath("/message-center");
  revalidatePath("/seller-crm");
}

export async function regenerateMessageAction(formData: FormData) {
  await requireOwner();
  const id = text(formData, "approvalId");
  const db = getPrisma();
  const approval = await db.messageApproval.findUnique({
    where: { id },
    include: { lead: { include: { property: true } } },
  });
  if (!approval) throw new Error("Message not found.");

  let body = approval.body;
  const subject = approval.subject ?? "";
  const pathway = pathwayFromApproval(subject);
  const storedTemplate = await db.messageTemplate.findUnique({
    where: { type_channel: { type: pathway, channel: approval.channel } },
  });
  const template = storedTemplate?.active
    ? storedTemplate.body
    : defaultPathwayTemplates[pathway];

  if (subject.startsWith("Acquisitions relationship:")) {
    const companyName = subject.replace("Acquisitions relationship:", "").trim();
    const developer = await db.developer.findUnique({ where: { companyName } });
    body = applyTemplate(template, {
      CONTACT: developer?.contactName || approval.recipientLabel,
      COMPANY: companyName,
    });
  } else if (subject.startsWith("Pricing request:")) {
    const address = subject.replace("Pricing request:", "").trim();
    const property = await db.property.findFirst({ where: { address } });
    if (property) {
      body = propertyPackageInquiry({
        name: approval.recipientLabel,
        address: property.address,
        zipCode: property.zipCode,
        lotSize: property.lotSize,
        yearBuilt: property.yearBuilt,
      });
    }
  } else if (approval.recipientLabel) {
    const property = approval.lead?.property ?? (await db.property.findFirst({
      where: { ownerName: approval.recipientLabel },
      orderBy: { updatedAt: "desc" },
    }));
    if (property) {
      body = applyTemplate(template, {
        OWNER: approval.recipientLabel,
        PROPERTY: property.address,
        CITY: property.city,
        STATE: property.state,
        ZIP: property.zipCode,
      });
    } else {
      body = sellerIntroduction({
        name: approval.recipientLabel,
        address: approval.recipientLabel,
        hasPhone: false,
      });
    }
  }

  await db.messageApproval.update({
    where: { id },
    data: { body, status: "PENDING", blockerCodes: [] },
  });
  revalidatePath("/message-center");
  revalidatePath("/seller-crm");
}

export async function savePathwayTemplateAction(formData: FormData) {
  await requireOwner();
  const pathway = pathwayType(text(formData, "pathway"));
  const channel = text(formData, "channel") as "SMS" | "EMAIL" | "VOICE" | "INTERNAL";
  const body = text(formData, "body") || defaultPathwayTemplates[pathway];
  if (!["SMS", "EMAIL", "VOICE", "INTERNAL"].includes(channel)) {
    throw new Error("Unsupported message channel.");
  }

  await getPrisma().messageTemplate.upsert({
    where: { type_channel: { type: pathway, channel } },
    update: { body, active: true },
    create: { type: pathway, channel, body, active: true },
  });
  revalidatePath("/message-center");
}
