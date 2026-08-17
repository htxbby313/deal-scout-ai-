"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { runCensusPermitResearch } from "@/lib/government-research";

import {
  attemptProviderSend,
  createDeveloper,
  createDeveloperProject,
  createLead,
  createMessageTemplate,
  createProperty,
  generateDeveloperPricingRequest,
  generateDraftApproval,
  importDevelopersCsv,
  importForeclosureCsv,
  importPropertiesCsv,
  runFollowUpScheduler,
  scoreDeveloperMatches,
  setApprovalStatus,
} from "@/lib/database";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function labeled(label: string, formData: FormData, key: string) {
  const entry = value(formData, key);
  return entry ? `${label}: ${entry}` : "";
}

export type CsvImportState = { status: "idle" | "success" | "error"; message: string };
export type ResearchRunState = { status: "idle" | "success" | "error"; message: string };

async function csvFile(formData: FormData) {
  const file = formData.get("csvFile");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a .csv file to import.");
  if (file.size > 5 * 1024 * 1024) throw new Error("CSV files must be 5 MB or smaller.");
  return { csvText: await file.text(), sourceName: file.name || "CSV import" };
}

export async function createPropertyAction(formData: FormData) {
  await requireOwner();
  await createProperty({
    address: value(formData, "address"),
    city: value(formData, "city"),
    state: value(formData, "state").toUpperCase(),
    zipCode: value(formData, "zipCode"),
    ownerName: value(formData, "ownerName"),
    marketFips: value(formData, "marketFips") || undefined,
    yearBuilt: value(formData, "yearBuilt"),
    lotSize: value(formData, "lotSize"),
    estimatedValue: Number(value(formData, "estimatedValue") || 0),
    notes: value(formData, "notes"),
    opportunityStatus: value(formData, "opportunityStatus") as "NEEDS_VERIFICATION" | "DEVELOPMENT_SIGNAL" | "CONFIRMED_AVAILABLE" | "GOVERNMENT_SALE" | "REJECTED",
    contactName: value(formData, "contactName"),
    contactPhone: value(formData, "contactPhone"),
    contactEmail: value(formData, "contactEmail"),
    sourceName: value(formData, "sourceName"),
    sourceUrl: value(formData, "sourceUrl"),
    sourceRecordDate: value(formData, "sourceRecordDate"),
    confidence: Number(value(formData, "confidence") || 0),
  });
  revalidatePath("/properties");
  const marketFips = value(formData, "marketFips");
  if (marketFips) revalidatePath(`/research/${marketFips}`);
}

export async function createLeadAction(formData: FormData) {
  await requireOwner();
  await createLead({
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
  await requireOwner();
  await createMessageTemplate({
    type: value(formData, "type"),
    channel: value(formData, "channel") as "SMS" | "EMAIL" | "VOICE" | "INTERNAL",
    body: value(formData, "body"),
  });
  revalidatePath("/");
}

export async function createDeveloperAction(formData: FormData) {
  await requireOwner();
  const crmNotes = [
    labeled("Buying status", formData, "buyingStatus"),
    labeled("Evidence level", formData, "evidenceLevel"),
    labeled("Property types", formData, "propertyTypes"),
    labeled("Target markets", formData, "targetMarkets"),
    labeled("Acquisition criteria", formData, "acquisitionCriteria"),
    labeled("Acreage range", formData, "acreageRange"),
    labeled("Entitlement preference", formData, "entitlementPreference"),
    labeled("Utility requirements", formData, "utilityRequirements"),
    labeled("Preferred deal structure", formData, "dealStructure"),
    labeled("Buy box source", formData, "buyBoxSource"),
    labeled("Last verified", formData, "lastVerified"),
    labeled("Next follow-up", formData, "nextFollowUp"),
    labeled("Acquisition criteria", formData, "notes"),
  ].filter(Boolean).join("\n");

  await createDeveloper({
    companyName: value(formData, "companyName"),
    contactName: value(formData, "contactName"),
    phone: value(formData, "phone"),
    email: value(formData, "email"),
    website: value(formData, "website"),
    targetZipCodes: value(formData, "targetZipCodes") || "Unknown",
    maximumPurchasePrice: Number(value(formData, "maximumPurchasePrice") || 0),
    typicalBuildPrice: Number(value(formData, "typicalBuildPrice") || 0),
    notes: crmNotes,
  });
  revalidatePath("/developers");
}

export async function createDeveloperProjectAction(formData: FormData) {
  await requireOwner();
  await createDeveloperProject({
    developerId: value(formData, "developerId"),
    address: value(formData, "address"),
    city: value(formData, "city"),
    state: value(formData, "state").toUpperCase(),
    zipCode: value(formData, "zipCode"),
    originalPurchasePrice: Number(value(formData, "originalPurchasePrice") || 0),
    newBuildSalePrice: Number(value(formData, "newBuildSalePrice") || 0),
    lotSquareFeet: Number(value(formData, "lotSquareFeet") || 0),
    notes: value(formData, "notes"),
    sourceName: value(formData, "sourceName"),
    sourceUrl: value(formData, "sourceUrl"),
    sourceRecordDate: value(formData, "sourceRecordDate"),
    confidence: Number(value(formData, "confidence") || 0),
  });
  revalidatePath("/developers");
}

export async function scoreDeveloperMatchesAction(formData: FormData) {
  await requireOwner();
  await scoreDeveloperMatches(value(formData, "propertyId"));
  revalidatePath("/");
}

export async function generateDeveloperPricingRequestAction(formData: FormData) {
  await requireOwner();
  await generateDeveloperPricingRequest(value(formData, "propertyId"), value(formData, "developerId"));
  revalidatePath("/");
  revalidatePath("/disposition");
}

export async function generateDraftAction(formData: FormData) {
  await requireOwner();
  await generateDraftApproval(value(formData, "templateId"), value(formData, "leadId"));
  revalidatePath("/");
}

export async function approveMessageAction(formData: FormData) {
  await requireOwner();
  await setApprovalStatus(value(formData, "approvalId"), "APPROVED");
  revalidatePath("/");
}

export async function rejectMessageAction(formData: FormData) {
  await requireOwner();
  await setApprovalStatus(value(formData, "approvalId"), "REJECTED");
  revalidatePath("/");
}

export async function blockedSendAttemptAction(formData: FormData) {
  await requireOwner();
  await attemptProviderSend(value(formData, "approvalId"));
  revalidatePath("/");
}

export async function runSchedulerAction() {
  await requireOwner();
  await runFollowUpScheduler();
  revalidatePath("/");
}

export async function importForeclosureCsvAction(formData: FormData) {
  await requireOwner();
  const file = formData.get("csvFile");
  if (!(file instanceof File)) {
    throw new Error("Choose a CSV file to import.");
  }
  const csvText = await file.text();
  await importForeclosureCsv({
    csvText,
    sourceName: file.name || "Foreclosure CSV",
  });
  revalidatePath("/");
}

export async function importDevelopersCsvAction(_previousState: CsvImportState, formData: FormData): Promise<CsvImportState> {
  await requireOwner();
  try {
    const result = await importDevelopersCsv(await csvFile(formData));
    revalidatePath("/developers");
    return { status: "success", message: `Imported ${result.created} buyer(s). Skipped ${result.skipped} duplicate or incomplete row(s).` };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "The developer CSV could not be imported." };
  }
}

export async function importPropertiesCsvAction(_previousState: CsvImportState, formData: FormData): Promise<CsvImportState> {
  await requireOwner();
  try {
    const result = await importPropertiesCsv(await csvFile(formData));
    revalidatePath("/properties");
    return { status: "success", message: `Imported ${result.created} propertie(s). Skipped ${result.skipped} duplicate or incomplete row(s).` };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "The property CSV could not be imported." };
  }
}

export async function runCensusPermitResearchAction(previousState: ResearchRunState): Promise<ResearchRunState> {
  void previousState;
  await requireOwner();
  try {
    const result = await runCensusPermitResearch();
    revalidatePath("/research");
    return { status: "success", message: `Ranked ${result.recordsFound} counties using Census permit data for ${result.period}.` };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "The Census permit scan failed." };
  }
}
