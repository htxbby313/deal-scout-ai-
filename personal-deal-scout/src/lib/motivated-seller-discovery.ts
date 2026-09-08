import "server-only";

import { getPrisma } from "@/lib/prisma";
import { firecrawlConfigured, searchPropertySourcesWithFirecrawl } from "@/lib/firecrawl-property-research";

const addressPattern = /\b(\d{1,6}\s+[a-z0-9.' -]{2,60}\s(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd|way|place|pl|circle|cir|trail|trl)),?\s+([a-z .'-]{2,40}),\s*([a-z]{2})\s+(\d{5})(?:-\d{4})?\b/i;
const excluded = /\b(?:hud|government owned|bank owned|\breo\b|foreclosure auction)\b/i;

export function parsePublicSellerCandidate(text: string) {
  if (excluded.test(text)) return null;
  const match = text.match(addressPattern);
  if (!match) return null;
  return { address: match[1].trim(), city: match[2].trim(), state: match[3].toUpperCase(), zipCode: match[4] };
}

export async function runMotivatedSellerDiscovery() {
  if (!firecrawlConfigured()) return { status: "not_configured" as const, searched: 0, created: 0, references: 0 };
  const db = getPrisma();
  const market = await db.marketSignal.findFirst({ orderBy: [{ capturedAt: "desc" }, { rank: "asc" }], select: { countyName: true, stateName: true } });
  if (!market) return { status: "no_market" as const, searched: 0, created: 0, references: 0 };
  const queries = [
    `"for sale by owner" property "${market.countyName}" "${market.stateName}"`,
    `("notice of default" OR "tax delinquent" OR "probate property") "${market.countyName}" "${market.stateName}"`,
  ];
  let created = 0;
  let references = 0;
  for (const query of queries) {
    const results = await searchPropertySourcesWithFirecrawl(query);
    for (const result of results) {
      const normalizedUrl = new URL(result.url).toString();
      const candidate = parsePublicSellerCandidate(`${result.title ?? ""} ${result.description ?? ""}`);
      const signal = query.includes("for sale by owner") ? "FSBO" : "PUBLIC_OWNER_PRESSURE";
      const property = candidate ? await db.property.upsert({
        where: { address_zipCode: { address: candidate.address, zipCode: candidate.zipCode } },
        update: {},
        create: {
          ...candidate,
          ownerName: "Research pending",
          leadSource: signal,
          sourceName: new URL(normalizedUrl).hostname.replace(/^www\./, ""),
          sourceUrl: normalizedUrl,
          sourceRecordDate: new Date().toISOString().slice(0, 10),
          notes: `Automatically discovered from a public search result matching ${signal}. Seller motivation and ownership remain unverified until source research completes.`,
        },
        select: { id: true, createdAt: true, updatedAt: true },
      }) : null;
      if (property && property.createdAt.getTime() === property.updatedAt.getTime()) created += 1;
      await db.propertyDiscoveryReference.upsert({
        where: { normalizedUrl },
        update: { propertyId: property?.id, lastComparedAt: new Date() },
        create: {
          propertyId: property?.id,
          providerKey: "firecrawl-public-search",
          originalUrl: result.url,
          normalizedUrl,
          status: property ? "CREATED_PROPERTY" : "NEEDS_REVIEW",
          submittedBy: "automatic-scout",
          observedAddress: candidate ? `${candidate.address}, ${candidate.city}, ${candidate.state} ${candidate.zipCode}` : null,
          observedAvailability: signal,
          observationNotes: [result.title, result.description].filter(Boolean).join(" — ").slice(0, 2000),
          verificationStatus: "AUTOMATIC_PUBLIC_RESULT_UNVERIFIED",
          lastComparedAt: new Date(),
        },
      });
      references += 1;
    }
  }
  return { status: "completed" as const, searched: queries.length, created, references };
}

export const __motivatedSellerDiscoveryTestables = { parsePublicSellerCandidate };
