import "server-only";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { enqueuePropertyResearch } from "@/lib/property-research";
import {
  compareDiscoveryObservation,
  prepareZillowDiscoveryReference,
  type ZillowDiscoveryInput,
} from "@/lib/zillow-discovery";
import { approvedZillowDatasetManifest } from "@/lib/zillow-market";

export async function ensureZillowMarketFoundation() {
  const db = getPrisma();
  return db.$transaction(
    async (tx) => {
      const provider = await tx.externalProvider.upsert({
        where: { key: "ZILLOW_RESEARCH" },
        update: {},
        create: {
          key: "ZILLOW_RESEARCH",
          displayName: "Zillow Research",
          kind: "AGGREGATE_MARKET_DATA",
          status: "DISABLED",
          liveRequestsEnabled: false,
          policy: {
            propertyPageFetch: false,
            imageFetch: false,
            approvedHost: "files.zillowstatic.com",
            approvedManifestOnly: true,
            attributionRequired: true,
          },
        },
      });
      for (const dataset of approvedZillowDatasetManifest) {
        await tx.marketDatasetDefinition.upsert({
          where: { key: dataset.key },
          update: {},
          create: {
            providerId: provider.id,
            key: dataset.key,
            name: dataset.name,
            definition: dataset.definition,
            canonicalCatalogUrl: dataset.canonicalCatalogUrl,
            directUrl: dataset.directUrl,
            geography: dataset.geography,
            propertyType: dataset.propertyType,
            frequency: dataset.frequency,
            identifierColumns: [...dataset.identifierColumns],
            dateColumnPattern: dataset.dateColumnPattern,
            expectedContentType: dataset.expectedContentType,
            expectedMaximumBytes: dataset.expectedMaximumBytes,
            attributionNote: dataset.attributionNote,
            fixtureHash: dataset.fixtureHash,
            reviewedBy: dataset.reviewedBy,
            reviewedAt: new Date(dataset.reviewedAt),
            enabled: false,
          },
        });
      }
      return {
        providerId: provider.id,
        datasets: approvedZillowDatasetManifest.length,
        liveRequestsEnabled: false as const,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function registerZillowDiscoveryReference(
  input: ZillowDiscoveryInput & { propertyId?: string; submittedBy: string },
) {
  const prepared = prepareZillowDiscoveryReference(input);
  const db = getPrisma();
  const existing = await db.propertyDiscoveryReference.findUnique({
    where: { normalizedUrl: prepared.normalizedUrl },
  });
  if (existing)
    return { reference: existing, duplicate: true, researchQueued: false };
  let reference;
  try {
    reference = await db.$transaction(
      async (tx) => {
        let propertyId = input.propertyId || undefined;
        let referenceStatus: "SUBMITTED" | "MATCHED" | "CREATED_PROPERTY" =
          "SUBMITTED";
        if (
          !propertyId &&
          prepared.observedAddress &&
          prepared.observedZipCode
        ) {
          const matched = await tx.property.findFirst({
            where: {
              address: {
                equals: prepared.observedAddress,
                mode: "insensitive",
              },
              zipCode: prepared.observedZipCode,
            },
            select: { id: true },
          });
          if (matched) {
            propertyId = matched.id;
            referenceStatus = "MATCHED";
          } else if (prepared.observedCity && prepared.observedState) {
            const createdProperty = await tx.property.create({
              data: {
                address: prepared.observedAddress,
                city: prepared.observedCity,
                state: prepared.observedState,
                zipCode: prepared.observedZipCode,
                ownerName: "Research pending",
                opportunityStatus: "NEEDS_VERIFICATION",
                sourceName: "Zillow discovery reference",
                sourceUrl: prepared.normalizedUrl,
                confidence: 0,
              },
            });
            propertyId = createdProperty.id;
            referenceStatus = "CREATED_PROPERTY";
          }
        }
        if (propertyId) {
          const property = await tx.property.findUnique({
            where: { id: propertyId },
            select: { id: true, address: true, estimatedValue: true },
          });
          if (!property) throw new Error("Property not found.");
          const comparison = compareDiscoveryObservation({
            observedAddress: prepared.observedAddress,
            observedAskingPrice: prepared.observedAskingPrice,
            officialAddress: property.address,
            officialAskingPrice: property.estimatedValue,
          });
          const created = await tx.propertyDiscoveryReference.create({
            data: {
              propertyId,
              status:
                referenceStatus === "SUBMITTED" ? "MATCHED" : referenceStatus,
              providerKey: prepared.providerKey,
              originalUrl: prepared.originalUrl,
              normalizedUrl: prepared.normalizedUrl,
              submittedBy: input.submittedBy,
              observedAddress: prepared.observedAddress,
              observedAskingPrice: prepared.observedAskingPrice,
              observedAvailability: prepared.observedAvailability,
              observationNotes: prepared.observationNotes,
              verificationStatus: prepared.verificationStatus,
              lastComparedAt: new Date(),
              conflictSummary: comparison.conflicts.length
                ? comparison
                : Prisma.JsonNull,
            },
          });
          await tx.auditLog.create({
            data: {
              type: "zillow.discovery_reference_submitted",
              summary:
                "Recorded a user-submitted Zillow property reference without fetching the page.",
              details: {
                referenceId: created.id,
                propertyId,
                providerKey: "ZILLOW",
                fetched: false,
                verificationStatus: prepared.verificationStatus,
                comparisonStatus: comparison.status,
                referenceStatus: created.status,
              },
            },
          });
          return created;
        }
        const created = await tx.propertyDiscoveryReference.create({
          data: {
            providerKey: prepared.providerKey,
            originalUrl: prepared.originalUrl,
            normalizedUrl: prepared.normalizedUrl,
            submittedBy: input.submittedBy,
            observedAddress: prepared.observedAddress,
            observedAskingPrice: prepared.observedAskingPrice,
            observedAvailability: prepared.observedAvailability,
            observationNotes: prepared.observationNotes,
            verificationStatus: prepared.verificationStatus,
          },
        });
        await tx.auditLog.create({
          data: {
            type: "zillow.discovery_reference_submitted",
            summary:
              "Recorded a user-submitted Zillow property reference without fetching the page.",
            details: {
              referenceId: created.id,
              propertyId: input.propertyId ?? null,
              providerKey: "ZILLOW",
              fetched: false,
              verificationStatus: prepared.verificationStatus,
            },
          },
        });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const winner = await db.propertyDiscoveryReference.findUnique({
        where: { normalizedUrl: prepared.normalizedUrl },
      });
      if (winner)
        return { reference: winner, duplicate: true, researchQueued: false };
    }
    throw error;
  }
  if (reference.propertyId) {
    await enqueuePropertyResearch(reference.propertyId);
    return { reference, duplicate: false, researchQueued: true };
  }
  return { reference, duplicate: false, researchQueued: false };
}
