import "server-only";

import { z } from "zod";
import { fetchValidatedJson } from "@/lib/research-runtime";

const ENDPOINT = "https://devapi.enformion.com/PropertyV2Search";
export const ENFORMION_SOURCE_URL = "https://go.enformion.com/developer-apis/property-search/";

const addressSchema = z.object({
  AddressLine1: z.string().optional(),
  AddressLine2: z.string().optional(),
  FullAddress: z.string().optional(),
  City: z.string().optional(),
  State: z.string().optional(),
  ZipCode: z.string().optional(),
}).strip();

const nameSchema = z.object({ FullName: z.string().optional(), CompanyName: z.string().nullable().optional() }).strip();
const ownerSchema = z.object({ Name: nameSchema.optional() }).strip();
const assessorSchema = z.object({
  PropertyIdentification: z.object({ ApnUnformatted: z.string().optional(), OnlineFormattedParcelId: z.string().optional(), ZoningCode: z.string().optional(), ZoningCodeDescription: z.string().optional() }).strip().optional(),
  Address: addressSchema.optional(),
  PropertyLegal: z.object({ LegalDescription: z.string().optional() }).strip().optional(),
  Owners: z.array(ownerSchema).max(10).optional(),
  Tax: z.object({ AssessedTotalValue: z.string().optional(), TaxAmount: z.string().optional(), TaxYear: z.string().optional(), AssessedYear: z.string().optional() }).strip().optional(),
  PropertySize: z.object({ FrontFootage: z.string().optional(), DepthFootage: z.string().optional(), Acres: z.string().optional(), LandSquareFootage: z.string().optional() }).strip().optional(),
  Utilities: z.object({ FuelCodeDescription: z.string().optional(), SewerCodeDescription: z.string().optional(), UtilitiesCodeDescription: z.string().optional(), WaterCodeDescription: z.string().optional() }).strip().optional(),
}).strip();

const responseSchema = z.object({
  PropertyV2Records: z.array(z.object({ Property: z.object({
    Summary: z.object({ Address: addressSchema.optional(), CurrentOwners: z.array(ownerSchema).max(10).optional(), Apn: z.string().optional(), AssessedValue: z.object({ Price: z.number().optional(), Date: z.string().optional() }).strip().optional() }).strip().optional(),
    AssessorRecords: z.array(assessorSchema).max(25).optional(),
  }).strip().optional() }).strip()).max(10).optional(),
  Counts: z.object({ SearchResults: z.number().optional() }).strip().optional(),
}).strip();

export type EnformionPropertyInput = { address: string; city: string; state: string; zipCode: string };
export type EnformionPropertyResult = {
  matched: boolean;
  ownerNames: string[];
  apn?: string;
  legalDescription?: string;
  assessedValue?: number;
  assessedYear?: string;
  taxAmount?: number;
  taxYear?: string;
  zoning?: string;
  dimensions?: string;
  utilities?: string;
};

function normalized(value: string | undefined) {
  return (value ?? "").toLowerCase().replace(/\b(street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|boulevard|blvd)\b/g, " ").replace(/[^a-z0-9]/g, "");
}

function addressMatches(input: EnformionPropertyInput, address: z.infer<typeof addressSchema> | undefined) {
  const expectedStreet = normalized(input.address);
  const actualStreet = normalized(address?.AddressLine1 ?? address?.FullAddress);
  const expectedZip = input.zipCode.replace(/\D/g, "").slice(0, 5);
  const actualZip = (address?.ZipCode ?? address?.AddressLine2 ?? address?.FullAddress ?? "").replace(/\D/g, "");
  const state = normalized(address?.State ?? address?.AddressLine2 ?? address?.FullAddress);
  return expectedStreet.length >= 4 && actualStreet.includes(expectedStreet) && actualZip.includes(expectedZip) && state.includes(normalized(input.state));
}

function cleanNumber(value: string | number | undefined) {
  const amount = typeof value === "number" ? value : Number((value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

export function parseEnformionProperty(input: EnformionPropertyInput, payload: unknown): EnformionPropertyResult {
  const parsed = responseSchema.parse(payload);
  for (const record of parsed.PropertyV2Records ?? []) {
    const summary = record.Property?.Summary;
    const assessors = record.Property?.AssessorRecords ?? [];
    const assessor = assessors.find((item) => addressMatches(input, item.Address)) ?? assessors[0];
    const address = summary?.Address ?? assessor?.Address;
    if (!addressMatches(input, address)) continue;
    const owners = [...(summary?.CurrentOwners ?? []), ...(assessor?.Owners ?? [])]
      .map((owner) => owner.Name?.CompanyName || owner.Name?.FullName)
      .filter((name): name is string => Boolean(name?.trim()));
    const size = assessor?.PropertySize;
    const utilities = assessor?.Utilities;
    return {
      matched: true,
      ownerNames: [...new Set(owners)],
      apn: assessor?.PropertyIdentification?.OnlineFormattedParcelId || assessor?.PropertyIdentification?.ApnUnformatted || summary?.Apn,
      legalDescription: assessor?.PropertyLegal?.LegalDescription || undefined,
      assessedValue: cleanNumber(assessor?.Tax?.AssessedTotalValue ?? summary?.AssessedValue?.Price),
      assessedYear: assessor?.Tax?.AssessedYear || summary?.AssessedValue?.Date || undefined,
      taxAmount: cleanNumber(assessor?.Tax?.TaxAmount),
      taxYear: assessor?.Tax?.TaxYear || undefined,
      zoning: [assessor?.PropertyIdentification?.ZoningCode, assessor?.PropertyIdentification?.ZoningCodeDescription].filter(Boolean).join(" — ") || undefined,
      dimensions: [size?.LandSquareFootage && `${size.LandSquareFootage} sq ft`, size?.Acres && `${size.Acres} acres`, size?.FrontFootage && `${size.FrontFootage} ft frontage`, size?.DepthFootage && `${size.DepthFootage} ft depth`].filter(Boolean).join(" · ") || undefined,
      utilities: [utilities?.WaterCodeDescription, utilities?.SewerCodeDescription, utilities?.UtilitiesCodeDescription, utilities?.FuelCodeDescription].filter(Boolean).join(" · ") || undefined,
    };
  }
  return { matched: false, ownerNames: [] };
}

export function enformionConfigured() {
  return Boolean(process.env.ENFORMION_ACCESS_PROFILE_NAME?.trim() && process.env.ENFORMION_ACCESS_PROFILE_PASSWORD?.trim());
}

export async function researchPropertyWithEnformion(input: EnformionPropertyInput) {
  const name = process.env.ENFORMION_ACCESS_PROFILE_NAME?.trim();
  const password = process.env.ENFORMION_ACCESS_PROFILE_PASSWORD?.trim();
  if (!name || !password) return null;
  const payload = await fetchValidatedJson(ENDPOINT, responseSchema, {
    method: "POST",
    attempts: 2,
    timeoutMs: 12_000,
    minimumHostIntervalMs: 550,
    maxBytes: 1_500_000,
    headers: { "content-type": "application/json", accept: "application/json", "galaxy-ap-name": name, "galaxy-ap-password": password, "galaxy-search-type": "PropertyV2" },
    body: JSON.stringify({ FirstName: "", LastName: "", AddressLine1: input.address, AddressLine2: `${input.city}, ${input.state} ${input.zipCode}`, Page: 1, ResultsPerPage: 3 }),
  });
  return parseEnformionProperty(input, payload);
}

export const __enformionPropertyTestables = { responseSchema, addressMatches };
