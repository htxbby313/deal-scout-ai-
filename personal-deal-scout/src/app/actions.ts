"use server";

import { revalidatePath } from "next/cache";

import {
  attemptProviderSend,
  createDeveloper,
  createDeveloperProject,
  createLead,
  createMessageTemplate,
  createProperty,
  generateDeveloperPricingRequest,
  generateDraftApproval,
  runFollowUpScheduler,
  scoreDeveloperMatches,
  setApprovalStatus,
} from "@/lib/database";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createPropertyAction(formData: FormData) {
  createProperty({
    address: value(formData, "address"),
    city: value(formData, "city"),
    state: value(formData, "state").toUpperCase(),
    zipCode: value(formData, "zipCode"),
    ownerName: value(formData, "ownerName"),
    yearBuilt: value(formData, "yearBuilt"),
    lotSize: value(formData, "lotSize"),
    notes: value(formData, "notes"),
  });
  revalidatePath("/");
}

export async function createLeadAction(formData: FormData) {
  createLead({
    propertyId: value(formData, "propertyId"),
    ownerName: value(formData, "ownerName"),
    status: value(formData, "status"),
    priority: value(formData, "priority"),
    nextActionType: value(formData, "nextActionType"),
    nextActionAt: value(formData, "nextActionAt"),
    estimatedAssignmentFee: Number(value(formData, "estimatedAssignmentFee")),
    notes: value(formData, "notes"),
  });
  revalidatePath("/");
}

export async function createMessageTemplateAction(formData: FormData) {
  createMessageTemplate({
    type: value(formData, "type"),
    channel: value(formData, "channel") as "SMS" | "EMAIL" | "VOICE" | "INTERNAL",
    body: value(formData, "body"),
  });
  revalidatePath("/");
}

export async function createDeveloperAction(formData: FormData) {
  createDeveloper({
    companyName: value(formData, "companyName"),
    contactName: value(formData, "contactName"),
    phone: value(formData, "phone"),
    email: value(formData, "email"),
    website: value(formData, "website"),
    targetZipCodes: value(formData, "targetZipCodes"),
    maximumPurchasePrice: Number(value(formData, "maximumPurchasePrice") || 0),
    typicalBuildPrice: Number(value(formData, "typicalBuildPrice") || 0),
    notes: value(formData, "notes"),
  });
  revalidatePath("/");
}

export async function createDeveloperProjectAction(formData: FormData) {
  createDeveloperProject({
    developerId: value(formData, "developerId"),
    address: value(formData, "address"),
    city: value(formData, "city"),
    state: value(formData, "state").toUpperCase(),
    zipCode: value(formData, "zipCode"),
    originalPurchasePrice: Number(value(formData, "originalPurchasePrice") || 0),
    newBuildSalePrice: Number(value(formData, "newBuildSalePrice") || 0),
    lotSquareFeet: Number(value(formData, "lotSquareFeet") || 0),
    notes: value(formData, "notes"),
  });
  revalidatePath("/");
}

export async function scoreDeveloperMatchesAction(formData: FormData) {
  scoreDeveloperMatches(value(formData, "propertyId"));
  revalidatePath("/");
}

export async function generateDeveloperPricingRequestAction(formData: FormData) {
  generateDeveloperPricingRequest(value(formData, "propertyId"), value(formData, "developerId"));
  revalidatePath("/");
}

export async function generateDraftAction(formData: FormData) {
  generateDraftApproval(value(formData, "templateId"), value(formData, "leadId"));
  revalidatePath("/");
}

export async function approveMessageAction(formData: FormData) {
  setApprovalStatus(value(formData, "approvalId"), "APPROVED");
  revalidatePath("/");
}

export async function rejectMessageAction(formData: FormData) {
  setApprovalStatus(value(formData, "approvalId"), "REJECTED");
  revalidatePath("/");
}

export async function blockedSendAttemptAction(formData: FormData) {
  attemptProviderSend(value(formData, "approvalId"));
  revalidatePath("/");
}

export async function runSchedulerAction() {
  runFollowUpScheduler();
  revalidatePath("/");
}
