import "server-only";

import { z } from "zod";
import { fetchValidatedJson } from "@/lib/research-runtime";
import { resolveIntegrationEnvironment } from "@/lib/integration-env";
import type { EnformionPropertyResult } from "@/lib/enformion-property";

export const RENTCAST_SOURCE_URL = "https://developers.rentcast.io/reference/property-records";
const ENDPOINT = "https://api.rentcast.io/v1/properties";

const addressSchema = z.object({
  formattedAddress: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().nullable().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
}).strip();

const assessmentSchema = z.object({
  year: z.number().optional(),
  value: z.number().optional(),
  land: z.number().optional(),
  improvements: z.number().optional(),
}).strip();

const taxSchema = z.object({
  year: z.number().optional(),
  total: z.number().optional(),
}).strip();

const featureSchema = z.object({
  architectureType: z.string().optional(),
  exteriorType: z.string().optional(),
  garage: z.boolean().optional(),
  garageSpaces: z.number().optional(),
  garageType: z.string().optional(),
  pool: z.boolean().optional(),
  poolType: z.string().optional(),
  unitCount: z.number().optional(),
}).strip();

const recordSchema = z.object({
  id: z.string().optional(),
  formattedAddress: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().nullable().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  county: z.string().optional(),
  countyFips: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  propertyType: z.string().optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  squareFootage: z.number().optional(),
  lotSize: z.number().optional(),
  yearBuilt: z.number().optional(),
  assessorID: z.string().optional(),
  legalDescription: z.string().optional(),
  subdivision: z.string().optional(),
  zoning: z.string().optional(),
  lastSaleDate: z.string().optional(),
  lastSalePrice: z.number().optional(),
  features: featureSchema.optional(),
  taxAssessments: z.record(z.string(), assessmentSchema).optional(),
  propertyTaxes: z.record(z.string(), taxSchema).optional(),
  owner: z.object({
    names: z.array(z.string()).max(20).optional(),
    type: z.string().optional(),
    mailingAddress: addressSchema.optional(),
  }).strip().optional(),
  ownerOccupied: z.boolean().optional(),
}).strip();

const responseSchema = z.array(recordSchema).max(10);

export type RentCastPropertyInput = {
  address: string;
  city: string;
  state: string;
  zipCode: string;
};

export type RentCastPropertyResult = EnformionPropertyResult & {
  county?: string;
  propertyType?: string;
  subdivision?: string;
  latitude?: number;
  longitude?: number;
  lastSaleDate?: string;
  lastSalePrice?: number;
};

function latestValue<T>(record: Record<string, T> | undefined) {
  if (!record) return undefined;
  const key = Object.keys(record).sort().at(-1);
  return key ? record[key] : undefined;
}

function normalize(value: string | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\b(street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|boulevard|blvd)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

function matches(input: RentCastPropertyInput, record: z.infer<typeof recordSchema>) {
  const street = normalize(record.addressLine1 ?? record.formattedAddress);
  const expectedStreet = normalize(input.address);
  const zip = (record.zipCode ?? record.formattedAddress ?? "").replace(/\D/g, "").slice(0, 5);
  return (
    expectedStreet.length >= 4 &&
    street.includes(expectedStreet) &&
    zip === input.zipCode.replace(/\D/g, "").slice(0, 5) &&
    normalize(record.state ?? record.formattedAddress).includes(normalize(input.state))
  );
}

function yesNo(value: boolean | undefined) {
  return value == null ? undefined : value ? "Yes" : "No";
}

export function parseRentCastProperty(
  input: RentCastPropertyInput,
  payload: unknown,
): RentCastPropertyResult {
  const records = responseSchema.parse(payload);
  const record = records.find((candidate) => matches(input, candidate));
  if (!record) return { matched: false, ownerNames: [] };

  const assessment = latestValue(record.taxAssessments);
  const tax = latestValue(record.propertyTaxes);
  const features = record.features;
  const mailing = record.owner?.mailingAddress;
  const mailingAddress = mailing?.formattedAddress ||
    [
      mailing?.addressLine1,
      mailing?.addressLine2,
      [mailing?.city, mailing?.state, mailing?.zipCode].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", ") || undefined;
  const acres = record.lotSize ? Number((record.lotSize / 43_560).toFixed(4)) : undefined;
  const constructionType = [features?.architectureType, features?.exteriorType]
    .filter(Boolean)
    .join(" · ") || undefined;
  const garage = features?.garage == null
    ? features?.garageType
    : [yesNo(features.garage), features.garageType].filter(Boolean).join(" · ");
  const pool = features?.pool == null
    ? features?.poolType
    : [yesNo(features.pool), features.poolType].filter(Boolean).join(" · ");

  return {
    matched: true,
    ownerNames: record.owner?.names ?? [],
    ownerType: record.owner?.type,
    ownerOccupied: yesNo(record.ownerOccupied),
    mailingAddress,
    apn: record.assessorID,
    legalDescription: record.legalDescription,
    landUse: record.propertyType,
    assessedValue: assessment?.value,
    assessedLandValue: assessment?.land,
    assessedImprovementValue: assessment?.improvements,
    taxAmount: tax?.total,
    taxYear: tax?.year != null ? String(tax.year) : undefined,
    assessedYear: assessment?.year != null ? String(assessment.year) : undefined,
    zoning: record.zoning,
    dimensions: [
      record.lotSize != null && `${record.lotSize.toLocaleString()} sq ft`,
      acres != null && `${acres} acres`,
    ].filter(Boolean).join(" · ") || undefined,
    landSquareFeet: record.lotSize,
    acres,
    buildingSquareFeet: record.squareFootage,
    yearBuilt: record.yearBuilt != null ? String(record.yearBuilt) : undefined,
    bedrooms: record.bedrooms,
    bathrooms: record.bathrooms,
    constructionType,
    garage,
    parkingSpaces: features?.garageSpaces,
    pool,
    numberOfUnits: features?.unitCount,
    county: record.county,
    propertyType: record.propertyType,
    subdivision: record.subdivision,
    latitude: record.latitude,
    longitude: record.longitude,
    lastSaleDate: record.lastSaleDate,
    lastSalePrice: record.lastSalePrice,
  };
}

export function rentCastConfigured() {
  return Boolean(resolveIntegrationEnvironment().rentcast.apiKey);
}

export async function researchPropertyWithRentCast(input: RentCastPropertyInput) {
  const apiKey = resolveIntegrationEnvironment().rentcast.apiKey;
  if (!apiKey) return null;
  const address = `${input.address}, ${input.city}, ${input.state} ${input.zipCode}`;
  const url = `${ENDPOINT}?address=${encodeURIComponent(address)}&limit=3`;
  const payload = await fetchValidatedJson(url, responseSchema, {
    attempts: 2,
    timeoutMs: 12_000,
    maxBytes: 1_500_000,
    headers: {
      accept: "application/json",
      "X-Api-Key": apiKey,
    },
  });
  return parseRentCastProperty(input, payload);
}

export const __rentCastPropertyTestables = { responseSchema, matches };
