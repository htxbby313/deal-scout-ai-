import "server-only";

import { z } from "zod";
import { fetchValidatedJson } from "@/lib/research-runtime";
import { resolveIntegrationEnvironment } from "@/lib/integration-env";

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

const nameSchema = z.object({
  FullName: z.string().optional(),
  CompanyName: z.string().nullable().optional(),
}).strip();

const ownerSchema = z.object({
  IsCorporationOrBusiness: z.boolean().optional(),
  Name: nameSchema.optional(),
}).strip();

const ownerMetaSchema = z.object({
  OwnerOccupancyCode: z.string().optional(),
  OwnerOccupancyCodeDescription: z.string().optional(),
  MailingAddresses: z.array(addressSchema).max(10).optional(),
  AddressLine1: z.string().optional(),
  AddressLine2: z.string().optional(),
  FullAddress: z.string().optional(),
}).strip();

const ownerMailingAddressSchema = z.object({
  HouseNumber: z.string().optional(),
  StreetPreDirection: z.string().optional(),
  StreetName: z.string().optional(),
  StreetPostDirection: z.string().optional(),
  StreetType: z.string().optional(),
  UnitType: z.string().optional(),
  UnitNumber: z.string().optional(),
  UnitNbr: z.string().optional(),
  City: z.string().optional(),
  State: z.string().optional(),
  Zip: z.string().optional(),
  ZipCode: z.string().optional(),
  Zip4: z.string().optional(),
  AddressLine1: z.string().optional(),
  AddressLine2: z.string().optional(),
  FullAddress: z.string().optional(),
}).strip();

const structureSchema = z.object({
  YearBuilt: z.string().optional(),
  Bedrooms: z.string().optional(),
  TotalBathrooms: z.string().optional(),
  NumberOfBathrooms: z.string().optional(),
  FullBaths: z.string().optional(),
  ConstructionTypeCode: z.string().optional(),
  ConstructionTypeCodeDescription: z.string().optional(),
  GarageCode: z.string().optional(),
  GarageCodeDescription: z.string().optional(),
  NumberOfParkingSpaces: z.string().optional(),
  ParkingTypeCode: z.string().optional(),
  ParkingTypeCodeDescription: z.string().optional(),
  PoolIndicator: z.string().optional(),
  PoolCode: z.string().optional(),
  PoolCodeDescription: z.string().optional(),
  NumberOfUnits: z.string().optional(),
}).strip();

const assessorSchema = z.object({
  PropertyIdentification: z.object({
    ApnUnformatted: z.string().optional(),
    OnlineFormattedParcelId: z.string().optional(),
    AlternateParcelId: z.string().optional(),
    ZoningCode: z.string().optional(),
    ZoningCodeDescription: z.string().optional(),
    LandUseCode: z.string().optional(),
    LandUseCodeDescription: z.string().optional(),
    CountyUseDescr: z.string().optional(),
    StateUseDescr: z.string().optional(),
  }).strip().optional(),
  Address: addressSchema.optional(),
  PropertyLegal: z.object({ LegalDescription: z.string().optional() }).strip().optional(),
  Owners: z.array(ownerSchema).max(10).optional(),
  OwnerMetaData: ownerMetaSchema.optional(),
  OwnerMailingAddress: z.array(ownerMailingAddressSchema).max(10).optional(),
  Tax: z.object({
    AssessedTotalValue: z.string().optional(),
    AssessedLandValue: z.string().optional(),
    AssessedImprovementValue: z.string().optional(),
    MarketTotalValue: z.string().optional(),
    MarketLandValue: z.string().optional(),
    MarketImprovementValue: z.string().optional(),
    AppraisedTotalValue: z.string().optional(),
    AppraisedLandValue: z.string().optional(),
    AppraisedImprovementValue: z.string().optional(),
    TaxAmount: z.string().optional(),
    TaxYear: z.string().optional(),
    AssessedYear: z.string().optional(),
  }).strip().optional(),
  PropertySize: z.object({
    FrontFootage: z.string().optional(),
    DepthFootage: z.string().optional(),
    Acres: z.string().optional(),
    LandSquareFootage: z.string().optional(),
    BuildingSquareFootage: z.string().optional(),
    TotalSquareFootage: z.string().optional(),
  }).strip().optional(),
  Structure: structureSchema.optional(),
  Utilities: z.object({
    FuelCodeDescription: z.string().optional(),
    SewerCodeDescription: z.string().optional(),
    UtilitiesCodeDescription: z.string().optional(),
    WaterCodeDescription: z.string().optional(),
  }).strip().optional(),
}).strip();

const responseSchema = z.object({
  PropertyV2Records: z.array(z.object({
    Property: z.object({
      Summary: z.object({
        Address: addressSchema.optional(),
        CurrentOwners: z.array(ownerSchema).max(10).optional(),
        CurrentOwnerMetaData: ownerMetaSchema.optional(),
        Apn: z.string().optional(),
        AssessedValue: z.object({
          Price: z.number().optional(),
          Date: z.string().optional(),
        }).strip().optional(),
      }).strip().optional(),
      AssessorRecords: z.array(assessorSchema).max(25).optional(),
    }).strip().optional(),
  }).strip()).max(10).optional(),
  Counts: z.object({ SearchResults: z.number().optional() }).strip().optional(),
}).strip();

export type EnformionPropertyInput = {
  address: string;
  city: string;
  state: string;
  zipCode: string;
};

export type EnformionPropertyResult = {
  matched: boolean;
  ownerNames: string[];
  ownerType?: string;
  ownerOccupied?: string;
  mailingAddress?: string;
  apn?: string;
  alternateParcelId?: string;
  legalDescription?: string;
  landUse?: string;
  assessedValue?: number;
  assessedLandValue?: number;
  assessedImprovementValue?: number;
  marketValue?: number;
  taxAmount?: number;
  taxYear?: string;
  assessedYear?: string;
  zoning?: string;
  dimensions?: string;
  landSquareFeet?: number;
  acres?: number;
  frontageFeet?: number;
  depthFeet?: number;
  buildingSquareFeet?: number;
  yearBuilt?: string;
  bedrooms?: number;
  bathrooms?: number;
  constructionType?: string;
  garage?: string;
  parkingSpaces?: number;
  pool?: string;
  numberOfUnits?: number;
  utilities?: string;
};

function normalized(value: string | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\b(street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|boulevard|blvd)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

function addressMatches(
  input: EnformionPropertyInput,
  address: z.infer<typeof addressSchema> | undefined,
) {
  const expectedStreet = normalized(input.address);
  const actualStreet = normalized(address?.AddressLine1 ?? address?.FullAddress);
  const expectedZip = input.zipCode.replace(/\D/g, "").slice(0, 5);
  const actualZip = (
    address?.ZipCode ??
    address?.AddressLine2 ??
    address?.FullAddress ??
    ""
  ).replace(/\D/g, "");
  const state = normalized(address?.State ?? address?.AddressLine2 ?? address?.FullAddress);
  return (
    expectedStreet.length >= 4 &&
    actualStreet.includes(expectedStreet) &&
    actualZip.includes(expectedZip) &&
    state.includes(normalized(input.state))
  );
}

function cleanNumber(value: string | number | undefined) {
  const amount =
    typeof value === "number"
      ? value
      : Number((value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

function firstNonBlank(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim();
}

function mailingAddress(
  summaryMeta: z.infer<typeof ownerMetaSchema> | undefined,
  assessor: z.infer<typeof assessorSchema> | undefined,
) {
  const direct = assessor?.OwnerMailingAddress?.[0];
  const fromParts = direct
    ? [
        direct.HouseNumber,
        direct.StreetPreDirection,
        direct.StreetName,
        direct.StreetType,
        direct.StreetPostDirection,
        direct.UnitType,
        direct.UnitNumber ?? direct.UnitNbr,
      ]
        .filter(Boolean)
        .join(" ")
    : undefined;
  const cityStateZip = direct
    ? [
        direct.City,
        [direct.State, direct.Zip ?? direct.ZipCode].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(", ")
    : undefined;
  return firstNonBlank(
    direct?.FullAddress,
    [direct?.AddressLine1, direct?.AddressLine2].filter(Boolean).join(", "),
    [fromParts, cityStateZip].filter(Boolean).join(", "),
    assessor?.OwnerMetaData?.MailingAddresses?.[0]?.FullAddress,
    summaryMeta?.MailingAddresses?.[0]?.FullAddress,
    summaryMeta?.FullAddress,
    [summaryMeta?.AddressLine1, summaryMeta?.AddressLine2].filter(Boolean).join(", "),
  );
}

function yesNoUnknown(indicator: string | undefined) {
  const normalizedIndicator = indicator?.trim().toUpperCase();
  if (!normalizedIndicator) return undefined;
  if (["Y", "YES", "1", "TRUE"].includes(normalizedIndicator)) return "Yes";
  if (["N", "NO", "0", "FALSE"].includes(normalizedIndicator)) return "No";
  return indicator?.trim();
}

export function parseEnformionProperty(
  input: EnformionPropertyInput,
  payload: unknown,
): EnformionPropertyResult {
  const parsed = responseSchema.parse(payload);
  for (const record of parsed.PropertyV2Records ?? []) {
    const summary = record.Property?.Summary;
    const assessors = record.Property?.AssessorRecords ?? [];
    const assessor = assessors.find((item) => addressMatches(input, item.Address)) ?? assessors[0];
    const address = summary?.Address ?? assessor?.Address;
    if (!addressMatches(input, address)) continue;

    const owners = [...(summary?.CurrentOwners ?? []), ...(assessor?.Owners ?? [])];
    const ownerNames = owners
      .map((owner) => owner.Name?.CompanyName || owner.Name?.FullName)
      .filter((name): name is string => Boolean(name?.trim()));
    const ownerType = owners.some((owner) => owner.IsCorporationOrBusiness)
      ? "Business / organization"
      : owners.length
        ? "Individual"
        : undefined;
    const ownerMeta = assessor?.OwnerMetaData ?? summary?.CurrentOwnerMetaData;
    const size = assessor?.PropertySize;
    const structure = assessor?.Structure;
    const utilities = assessor?.Utilities;
    const identification = assessor?.PropertyIdentification;
    const tax = assessor?.Tax;

    const landUse = firstNonBlank(
      identification?.CountyUseDescr,
      identification?.StateUseDescr,
      identification?.LandUseCodeDescription,
      identification?.LandUseCode,
    );
    const constructionType = firstNonBlank(
      structure?.ConstructionTypeCodeDescription,
      structure?.ConstructionTypeCode,
    );
    const garage =
      firstNonBlank(structure?.GarageCodeDescription, structure?.ParkingTypeCodeDescription) ??
      (structure?.GarageCode || structure?.ParkingTypeCode ? "Yes" : undefined);
    const pool =
      yesNoUnknown(structure?.PoolIndicator) ??
      firstNonBlank(structure?.PoolCodeDescription, structure?.PoolCode);
    const assessedValue = cleanNumber(tax?.AssessedTotalValue ?? summary?.AssessedValue?.Price);
    const assessedLandValue = cleanNumber(tax?.AssessedLandValue);
    const assessedImprovementValue = cleanNumber(tax?.AssessedImprovementValue);
    const marketValue = cleanNumber(tax?.MarketTotalValue ?? tax?.AppraisedTotalValue);
    const landSquareFeet = cleanNumber(size?.LandSquareFootage);
    const acres = cleanNumber(size?.Acres);
    const frontageFeet = cleanNumber(size?.FrontFootage);
    const depthFeet = cleanNumber(size?.DepthFootage);
    const buildingSquareFeet = cleanNumber(
      size?.BuildingSquareFootage ?? size?.TotalSquareFootage,
    );

    return {
      matched: true,
      ownerNames: [...new Set(ownerNames)],
      ownerType,
      ownerOccupied: firstNonBlank(
        ownerMeta?.OwnerOccupancyCodeDescription,
        ownerMeta?.OwnerOccupancyCode,
      ),
      mailingAddress: mailingAddress(summary?.CurrentOwnerMetaData, assessor),
      apn:
        identification?.OnlineFormattedParcelId ||
        identification?.ApnUnformatted ||
        summary?.Apn,
      alternateParcelId: identification?.AlternateParcelId || undefined,
      legalDescription: assessor?.PropertyLegal?.LegalDescription || undefined,
      landUse,
      assessedValue,
      assessedLandValue,
      assessedImprovementValue,
      marketValue,
      assessedYear: tax?.AssessedYear || summary?.AssessedValue?.Date || undefined,
      taxAmount: cleanNumber(tax?.TaxAmount),
      taxYear: tax?.TaxYear || undefined,
      zoning: [
        identification?.ZoningCode,
        identification?.ZoningCodeDescription,
      ]
        .filter(Boolean)
        .join(" — ") || undefined,
      dimensions: [
        landSquareFeet != null && `${landSquareFeet.toLocaleString()} sq ft`,
        acres != null && `${acres} acres`,
        frontageFeet != null && `${frontageFeet} ft frontage`,
        depthFeet != null && `${depthFeet} ft depth`,
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
      landSquareFeet,
      acres,
      frontageFeet,
      depthFeet,
      buildingSquareFeet,
      yearBuilt: structure?.YearBuilt || undefined,
      bedrooms: cleanNumber(structure?.Bedrooms),
      bathrooms: cleanNumber(
        structure?.TotalBathrooms ?? structure?.NumberOfBathrooms ?? structure?.FullBaths,
      ),
      constructionType,
      garage,
      parkingSpaces: cleanNumber(structure?.NumberOfParkingSpaces),
      pool,
      numberOfUnits: cleanNumber(structure?.NumberOfUnits),
      utilities: [
        utilities?.WaterCodeDescription,
        utilities?.SewerCodeDescription,
        utilities?.UtilitiesCodeDescription,
        utilities?.FuelCodeDescription,
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
    };
  }
  return { matched: false, ownerNames: [] };
}

export function enformionConfigured() {
  const { username, password } = resolveIntegrationEnvironment().enformion;
  return Boolean(username && password);
}

export async function researchPropertyWithEnformion(input: EnformionPropertyInput) {
  const { username: name, password } = resolveIntegrationEnvironment().enformion;
  if (!name || !password) return null;
  const payload = await fetchValidatedJson(ENDPOINT, responseSchema, {
    method: "POST",
    attempts: 2,
    timeoutMs: 12_000,
    minimumHostIntervalMs: 550,
    maxBytes: 1_500_000,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "galaxy-ap-name": name,
      "galaxy-ap-password": password,
      "galaxy-search-type": "PropertyV2",
    },
    body: JSON.stringify({
      FirstName: "",
      LastName: "",
      AddressLine1: input.address,
      AddressLine2: `${input.city}, ${input.state} ${input.zipCode}`,
      Page: 1,
      ResultsPerPage: 3,
    }),
  });
  return parseEnformionProperty(input, payload);
}

export const __enformionPropertyTestables = {
  responseSchema,
  addressMatches,
};
