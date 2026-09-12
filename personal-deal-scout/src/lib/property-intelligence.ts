import "server-only";

import { getPrisma } from "@/lib/prisma";
import {
  ENFORMION_SOURCE_URL,
  enformionConfigured,
  researchPropertyWithEnformion,
  type EnformionPropertyResult,
} from "@/lib/enformion-property";
import { reserveEnformionLookup } from "@/lib/enformion-budget";

const SNAPSHOT_TYPE = "research.property_intelligence_snapshot";

export type PropertyIntelligenceSnapshot = {
  propertyId: string;
  capturedAt: string;
  sourceName: "Enformion Property Search";
  sourceUrl: string;
  result: EnformionPropertyResult;
};

function isSnapshot(value: unknown): value is PropertyIntelligenceSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.propertyId === "string" &&
    typeof candidate.capturedAt === "string" &&
    candidate.sourceName === "Enformion Property Search" &&
    typeof candidate.sourceUrl === "string" &&
    Boolean(candidate.result && typeof candidate.result === "object")
  );
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
  if (!enformionConfigured())
    throw new Error("The Enformion property source is not configured.");

  const budget = await reserveEnformionLookup(propertyId);
  if (!budget.reserved)
    throw new Error(
      `The Enformion monthly lookup limit has been reached (${budget.used}/${budget.limit}).`,
    );

  const result = await researchPropertyWithEnformion(property);
  if (!result?.matched)
    throw new Error("No matching assessor record was returned for this address.");

  const snapshot: PropertyIntelligenceSnapshot = {
    propertyId,
    capturedAt: new Date().toISOString(),
    sourceName: "Enformion Property Search",
    sourceUrl: ENFORMION_SOURCE_URL,
    result,
  };

  await db.auditLog.create({
    data: {
      type: SNAPSHOT_TYPE,
      summary: `Captured full property intelligence for ${property.address}.`,
      details: snapshot,
    },
  });

  return snapshot;
}
