import "server-only";

import { getPrisma } from "@/lib/prisma";
import {
  ENFORMION_SOURCE_URL,
  enformionConfigured,
  researchPropertyWithEnformion,
  type EnformionPropertyResult,
} from "@/lib/enformion-property";
import { reserveEnformionLookup } from "@/lib/enformion-budget";
import {
  RENTCAST_SOURCE_URL,
  rentCastConfigured,
  researchPropertyWithRentCast,
} from "@/lib/rentcast-property";
import { reserveRentCastLookup } from "@/lib/rentcast-budget";

const SNAPSHOT_TYPE = "research.property_intelligence_snapshot";

type PropertyIntelligenceSource = "RentCast Property Records" | "Enformion Property Search";

export type PropertyIntelligenceSnapshot = {
  propertyId: string;
  capturedAt: string;
  sourceName: PropertyIntelligenceSource;
  sourceUrl: string;
  result: EnformionPropertyResult;
};

function isSnapshot(value: unknown): value is PropertyIntelligenceSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.propertyId === "string" &&
    typeof candidate.capturedAt === "string" &&
    ["RentCast Property Records", "Enformion Property Search"].includes(
      String(candidate.sourceName),
    ) &&
    typeof candidate.sourceUrl === "string" &&
    Boolean(candidate.result && typeof candidate.result === "object")
  );
}

export function propertyIntelligenceConfigured() {
  return rentCastConfigured() || enformionConfigured();
}

export async function getLatestPropertyIntelligence(propertyId: string) {
  const row = await getPrisma().auditLog.findFirst({
    where: {
      type: SNAPSHOT_TYPE,
      details: { path: ["propertyId"], equals: propertyId },
    },
    orderBy: { createdAt: "desc" },
    select: { details: true, createdAt: true },
  });
  if (!row || !isSnapshot(row.details)) return null;
  return {
    ...row.details,
    capturedAt: row.createdAt.toISOString(),
  } satisfies PropertyIntelligenceSnapshot;
}

async function researchWithRentCast(
  propertyId: string,
  property: { address: string; city: string; state: string; zipCode: string },
) {
  if (!rentCastConfigured()) return null;
  const budget = await reserveRentCastLookup(propertyId);
  if (!budget.reserved)
    throw new Error(
      `The RentCast monthly lookup limit has been reached (${budget.used}/${budget.limit}).`,
    );
  const result = await researchPropertyWithRentCast(property);
  if (!result?.matched) return null;
  return {
    sourceName: "RentCast Property Records" as const,
    sourceUrl: RENTCAST_SOURCE_URL,
    result,
  };
}

async function researchWithEnformion(
  propertyId: string,
  property: { address: string; city: string; state: string; zipCode: string },
) {
  if (!enformionConfigured()) return null;
  const budget = await reserveEnformionLookup(propertyId);
  if (!budget.reserved)
    throw new Error(
      `The Enformion monthly lookup limit has been reached (${budget.used}/${budget.limit}).`,
    );
  const result = await researchPropertyWithEnformion(property);
  if (!result?.matched) return null;
  return {
    sourceName: "Enformion Property Search" as const,
    sourceUrl: ENFORMION_SOURCE_URL,
    result,
  };
}

export async function refreshPropertyIntelligence(propertyId: string) {
  const db = getPrisma();
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
    },
  });
  if (!property) throw new Error("Property was not found.");
  if (!propertyIntelligenceConfigured())
    throw new Error("No full property intelligence source is configured.");

  const provider =
    (await researchWithRentCast(propertyId, property)) ??
    (await researchWithEnformion(propertyId, property));

  if (!provider)
    throw new Error("No matching property record was returned for this address.");

  const snapshot: PropertyIntelligenceSnapshot = {
    propertyId,
    capturedAt: new Date().toISOString(),
    sourceName: provider.sourceName,
    sourceUrl: provider.sourceUrl,
    result: provider.result,
  };

  await db.auditLog.create({
    data: {
      type: SNAPSHOT_TYPE,
      summary: `Captured full property intelligence for ${property.address} from ${provider.sourceName}.`,
      details: snapshot,
    },
  });

  return snapshot;
}
