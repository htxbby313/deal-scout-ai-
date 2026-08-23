"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireOwner } from "@/lib/auth";
import { runCensusPermitResearch } from "@/lib/government-research";
import { importHudReoCounty } from "@/lib/hud-reo";
import {
  enqueueDeveloperResearch,
  runAutomaticDeveloperResearchBatch,
  runQueuedDeveloperResearch,
} from "@/lib/developer-research";
import {
  addSourcedPropertyMedia,
  enqueuePropertyResearch,
  researchProperty,
  runAutomaticPropertyResearchBatch,
  runQueuedPropertyResearch,
  setPropertyMediaApproval,
} from "@/lib/property-research";
import { enqueueResearchBacklog } from "@/lib/research-operations";
import { enqueueAgentOperations } from "@/lib/agent-queue";

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
  retireProperty,
  scoreDeveloperMatches,
  setApprovalStatus,
  updatePropertyEvidence,
} from "@/lib/database";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function labeled(label: string, formData: FormData, key: string) {
  const entry = value(formData, key);
  return entry ? `${label}: ${entry}` : "";
}

export type CsvImportState = {
  status: "idle" | "success" | "error";
  message: string;
};
export type ResearchRunState = {
  status: "idle" | "success" | "error";
  message: string;
};
export type EvidenceUpdateState = {
  status: "idle" | "success" | "error";
  message: string;
};

async function csvFile(formData: FormData) {
  const file = formData.get("csvFile");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv"))
    throw new Error("Choose a .csv file to import.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("CSV files must be 5 MB or smaller.");
  return { csvText: await file.text(), sourceName: file.name || "CSV import" };
}

export async function createPropertyAction(formData: FormData) {
  await requireOwner();
  const property = await createProperty({
    address: value(formData, "address"),
    city: value(formData, "city"),
    state: value(formData, "state").toUpperCase(),
    zipCode: value(formData, "zipCode"),
    ownerName: value(formData, "ownerName"),
    county: value(formData, "county"),
    neighborhood: value(formData, "neighborhood"),
    propertyType: value(formData, "propertyType"),
    latitude: value(formData, "latitude")
      ? Number(value(formData, "latitude"))
      : undefined,
    longitude: value(formData, "longitude")
      ? Number(value(formData, "longitude"))
      : undefined,
    marketFips: value(formData, "marketFips") || undefined,
    yearBuilt: value(formData, "yearBuilt"),
    lotSize: value(formData, "lotSize"),
    estimatedValue: Number(value(formData, "estimatedValue") || 0),
    notes: value(formData, "notes"),
    opportunityStatus: value(formData, "opportunityStatus") as
      | "NEEDS_VERIFICATION"
      | "DEVELOPMENT_SIGNAL"
      | "CONFIRMED_AVAILABLE"
      | "GOVERNMENT_SALE"
      | "REJECTED",
    contactName: value(formData, "contactName"),
    contactPhone: value(formData, "contactPhone"),
    contactEmail: value(formData, "contactEmail"),
    contactUrl: value(formData, "contactUrl"),
    sourceName: value(formData, "sourceName"),
    sourceUrl: value(formData, "sourceUrl"),
    sourceRecordDate: value(formData, "sourceRecordDate"),
    confidence: Number(value(formData, "confidence") || 0),
  });
  const queued = await enqueuePropertyResearch(property.id);
  after(async () => {
    await runQueuedPropertyResearch(queued.id);
    await enqueueAgentOperations("EVENT");
  });
  revalidatePath("/properties");
  const marketFips = value(formData, "marketFips");
  if (marketFips) revalidatePath(`/research/${marketFips}`);
}

export async function updatePropertyEvidenceAction(
  propertyId: string,
  _previousState: EvidenceUpdateState,
  formData: FormData,
): Promise<EvidenceUpdateState> {
  await requireOwner();
  try {
    await updatePropertyEvidence({
      propertyId,
      estimatedValue: Number(value(formData, "estimatedValue")),
      opportunityStatus: value(formData, "opportunityStatus") as
        "CONFIRMED_AVAILABLE" | "GOVERNMENT_SALE",
      contactName: value(formData, "contactName"),
      contactPhone: value(formData, "contactPhone"),
      contactEmail: value(formData, "contactEmail"),
      contactUrl: value(formData, "contactUrl"),
      verificationSourceUrl: value(formData, "verificationSourceUrl"),
      verificationDate: value(formData, "verificationDate"),
      confidence: Number(value(formData, "confidence")),
      notes: value(formData, "notes"),
    });
    after(async () => {
      await enqueueAgentOperations("EVENT");
    });
    revalidatePath("/properties");
    revalidatePath("/disposition");
    return {
      status: "success",
      message: "Evidence saved. Readiness was recalculated.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Property evidence could not be updated.",
    };
  }
}

export async function retirePropertyAction(
  propertyId: string,
  _previousState: EvidenceUpdateState,
  formData: FormData,
): Promise<EvidenceUpdateState> {
  await requireOwner();
  try {
    await retireProperty({
      propertyId,
      retirementReason: value(formData, "retirementReason") as
        "OFF_MARKET" | "SOLD" | "SOURCE_CONFLICT" | "DUPLICATE" | "OTHER",
      verificationSourceUrl: value(formData, "verificationSourceUrl"),
      verificationDate: value(formData, "verificationDate"),
      confidence: Number(value(formData, "confidence")),
      notes: value(formData, "notes"),
    });
    revalidatePath("/properties");
    revalidatePath("/disposition");
    return {
      status: "success",
      message: "Property retired with dated evidence. Matching remains locked.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Property could not be retired.",
    };
  }
}

export async function researchPropertyAction(
  propertyId: string,
  _previousState: ResearchRunState,
): Promise<ResearchRunState> {
  void _previousState;
  await requireOwner();
  try {
    const result = await researchProperty(propertyId);
    after(async () => {
      await enqueueAgentOperations("EVENT");
    });
    revalidatePath("/properties");
    revalidatePath("/disposition");
    revalidatePath("/operations");
    return {
      status: "success",
      message: `Research updated: ${result.verified} verified detail(s), ${result.mediaFound} image(s), ${result.manualNeeded} additional detail(s) still unavailable.`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Property research failed.",
    };
  }
}

export async function researchDeveloperAction(
  developerId: string,
  _previousState: ResearchRunState,
): Promise<ResearchRunState> {
  void _previousState;
  await requireOwner();
  try {
    const queued = await enqueueDeveloperResearch(developerId);
    const result = await runQueuedDeveloperResearch(queued.id);
    after(async () => {
      await enqueueAgentOperations("EVENT");
    });
    revalidatePath("/developers");
    revalidatePath("/operations");
    if (result.status === "failed")
      return { status: "error", message: result.error };
    if (result.status === "skipped")
      return { status: "success", message: "Research is already running." };
    return {
      status: "success",
      message: `Research updated: ${result.findingsFound} verified category(s), ${result.manualNeeded} additional category(s) still unavailable.`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Developer research failed.",
    };
  }
}

export async function runResearchBacklogAction(
  _previousState: ResearchRunState,
): Promise<ResearchRunState> {
  void _previousState;
  await requireOwner();
  try {
    const queued = await enqueueResearchBacklog();
    const [properties, developers] = await Promise.all([
      runAutomaticPropertyResearchBatch(2),
      runAutomaticDeveloperResearchBatch(5),
    ]);
    revalidatePath("/operations");
    revalidatePath("/properties");
    revalidatePath("/developers");
    revalidatePath("/disposition");
    return {
      status: "success",
      message: `${queued.properties} properties and ${queued.developers} developers queued; ${properties.processed + developers.processed} processed now.`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Research backlog could not run.",
    };
  }
}

export async function reviewPropertyMediaAction(formData: FormData) {
  await requireOwner();
  const propertyId = value(formData, "propertyId");
  await setPropertyMediaApproval(
    propertyId,
    value(formData, "mediaId"),
    value(formData, "approved") === "true",
  );
  revalidatePath("/properties");
  revalidatePath("/disposition");
}

export async function addPropertyMediaAction(formData: FormData) {
  await requireOwner();
  const propertyId = value(formData, "propertyId");
  await addSourcedPropertyMedia({
    propertyId,
    url: value(formData, "url"),
    sourceUrl: value(formData, "sourceUrl"),
    sourceName: value(formData, "sourceName"),
    caption: value(formData, "caption"),
  });
  revalidatePath("/properties");
  revalidatePath("/disposition");
}

export async function createLeadAction(formData: FormData) {
  await requireOwner();
  const propertyId = value(formData, "propertyId");
  await createLead({
    propertyId,
    ownerName: value(formData, "ownerName"),
    status: value(formData, "status"),
    priority: value(formData, "priority"),
    nextActionType: value(formData, "nextActionType"),
    nextActionAt: value(formData, "nextActionAt"),
    estimatedAssignmentFee: Number(value(formData, "estimatedAssignmentFee")),
    notes: value(formData, "notes"),
  });
  const queued = await enqueuePropertyResearch(propertyId);
  after(async () => {
    await runQueuedPropertyResearch(queued.id);
  });
  revalidatePath("/");
  revalidatePath("/properties");
}

export async function createMessageTemplateAction(formData: FormData) {
  await requireOwner();
  await createMessageTemplate({
    type: value(formData, "type"),
    channel: value(formData, "channel") as
      "SMS" | "EMAIL" | "VOICE" | "INTERNAL",
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
  ]
    .filter(Boolean)
    .join("\n");

  const developer = await createDeveloper({
    companyName: value(formData, "companyName"),
    contactName: value(formData, "contactName"),
    phone: value(formData, "phone"),
    email: value(formData, "email"),
    website: value(formData, "website"),
    contactUrl: value(formData, "contactUrl"),
    targetZipCodes: value(formData, "targetZipCodes") || "Unknown",
    maximumPurchasePrice: Number(value(formData, "maximumPurchasePrice") || 0),
    typicalBuildPrice: Number(value(formData, "typicalBuildPrice") || 0),
    notes: crmNotes,
  });
  const queued = await enqueueDeveloperResearch(developer.id);
  after(async () => {
    await runQueuedDeveloperResearch(queued.id);
    await enqueueAgentOperations("EVENT");
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
    originalPurchasePrice: Number(
      value(formData, "originalPurchasePrice") || 0,
    ),
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

export async function generateDeveloperPricingRequestAction(
  formData: FormData,
) {
  await requireOwner();
  await generateDeveloperPricingRequest(
    value(formData, "propertyId"),
    value(formData, "developerId"),
  );
  revalidatePath("/");
  revalidatePath("/disposition");
}

export async function generateDraftAction(formData: FormData) {
  await requireOwner();
  await generateDraftApproval(
    value(formData, "templateId"),
    value(formData, "leadId"),
  );
  revalidatePath("/");
}

export async function approveMessageAction(formData: FormData) {
  await requireOwner();
  await setApprovalStatus(value(formData, "approvalId"), "APPROVED");
  revalidatePath("/");
  revalidatePath("/owner-queue");
  revalidatePath("/seller-crm");
}

export async function rejectMessageAction(formData: FormData) {
  await requireOwner();
  await setApprovalStatus(value(formData, "approvalId"), "REJECTED");
  revalidatePath("/");
  revalidatePath("/owner-queue");
  revalidatePath("/seller-crm");
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

export async function importDevelopersCsvAction(
  _previousState: CsvImportState,
  formData: FormData,
): Promise<CsvImportState> {
  await requireOwner();
  try {
    const result = await importDevelopersCsv(await csvFile(formData));
    const runs: Array<{ id: string }> = [];
    for (const developerId of result.createdIds)
      runs.push(await enqueueDeveloperResearch(developerId));
    if (runs.length)
      after(async () => {
        for (const run of runs) await runQueuedDeveloperResearch(run.id);
      });
    revalidatePath("/developers");
    return {
      status: "success",
      message: `Imported ${result.created} buyer(s); automatic public-source research started for ${result.createdIds.length}. Skipped ${result.skipped} duplicate or incomplete row(s).`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The developer CSV could not be imported.",
    };
  }
}

export async function importPropertiesCsvAction(
  _previousState: CsvImportState,
  formData: FormData,
): Promise<CsvImportState> {
  await requireOwner();
  try {
    const result = await importPropertiesCsv(await csvFile(formData));
    const runs: Array<{ id: string }> = [];
    for (const propertyId of result.createdIds)
      runs.push(await enqueuePropertyResearch(propertyId));
    if (runs.length)
      after(async () => {
        for (const run of runs) await runQueuedPropertyResearch(run.id);
      });
    revalidatePath("/properties");
    return {
      status: "success",
      message: `Imported ${result.created} propertie(s); automatic public-source research started for ${result.createdIds.length}. Skipped ${result.skipped} duplicate or incomplete row(s).`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The property CSV could not be imported.",
    };
  }
}

export async function runCensusPermitResearchAction(
  previousState: ResearchRunState,
): Promise<ResearchRunState> {
  void previousState;
  await requireOwner();
  try {
    const result = await runCensusPermitResearch();
    revalidatePath("/research");
    return {
      status: "success",
      message: `Ranked ${result.recordsFound} counties using Census permit data for ${result.period}.`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The Census permit scan failed.",
    };
  }
}

export async function importHudReoCountyAction(
  fips: string,
  previousState: ResearchRunState,
): Promise<ResearchRunState> {
  void previousState;
  await requireOwner();
  try {
    const result = await importHudReoCounty(fips);
    revalidatePath(`/research/${fips}`);
    revalidatePath("/properties");
    return {
      status: "success",
      message: `HUD found ${result.found}; created ${result.created}; refreshed ${result.refreshed}; retired ${result.retired}; skipped ${result.skipped} source collision(s).`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "The HUD REO import failed.",
    };
  }
}
