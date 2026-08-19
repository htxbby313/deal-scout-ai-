"use server";

import { revalidatePath } from "next/cache";
import type { CountyAgencyType, CountyAutomationStatus } from "@prisma/client";
import { requireOwner } from "@/lib/auth";
import { registerCountySource, upsertCountyRegistry } from "@/lib/county-source-service";

const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const list = (data: FormData, key: string) => value(data, key).split(",").map((item) => item.trim()).filter(Boolean);
export async function createCountyRegistryAction(data: FormData) { await requireOwner(); await upsertCountyRegistry({ stateCode: value(data, "stateCode"), countyName: value(data, "countyName"), fipsCode: value(data, "fipsCode"), actor: "owner", manualSearchInstructions: value(data, "manualSearchInstructions") || undefined }); revalidatePath("/county-coverage"); }
export async function registerCountySourceAction(data: FormData) { await requireOwner(); await registerCountySource({ registryId: value(data, "registryId"), agencyName: value(data, "agencyName"), agencyType: value(data, "agencyType") as CountyAgencyType, officialUrl: value(data, "officialUrl"), delegationEvidenceUrl: value(data, "delegationEvidenceUrl") || undefined, propertySearchUrl: value(data, "propertySearchUrl") || undefined, parcelGisUrl: value(data, "parcelGisUrl") || undefined, taxUrl: value(data, "taxUrl") || undefined, recorderUrl: value(data, "recorderUrl") || undefined, accessMethod: value(data, "accessMethod"), authenticationRequired: data.get("authenticationRequired") === "on", subscriptionRequired: data.get("subscriptionRequired") === "on", automationStatus: value(data, "automationStatus") as CountyAutomationStatus, supportedSearches: list(data, "supportedSearches"), availableFields: list(data, "availableFields"), sourceConfidence: Number(value(data, "sourceConfidence")), actor: "owner" }); revalidatePath("/county-coverage"); }
