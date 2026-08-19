import "server-only";

import { Prisma, type CountyAgencyType, type CountyAutomationStatus, type CountyCoverageStatus } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { validateCountyIdentity } from "@/lib/county-source-policy";

const stateCodeByFips: Record<string, string> = { "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY" };

function https(raw: string) { const url = new URL(raw); if (url.protocol !== "https:") throw new Error("County sources must use HTTPS."); return url; }
function officialDomain(raw: string, delegationEvidenceUrl?: string) { const url = https(raw); const government = url.hostname.endsWith(".gov") || url.hostname.endsWith(".us"); if (!government && !delegationEvidenceUrl) throw new Error("A non-government vendor requires an official delegation evidence URL."); if (delegationEvidenceUrl) https(delegationEvidenceUrl); return url.origin; }

export async function synchronizeCountyCoverageTargets(now = new Date()) {
  const db = getPrisma();
  const [properties, projects, signals] = await Promise.all([
    db.property.findMany({ where: { marketFips: { not: null }, countyRegistryId: null, opportunityStatus: { not: "REJECTED" } }, select: { id: true, state: true, county: true, marketFips: true } }),
    db.developerProject.findMany({ where: { countyRegistryId: null }, select: { id: true, state: true, sourceName: true, zipCode: true } }),
    db.marketSignal.findMany({ orderBy: { capturedAt: "desc" }, take: 500, select: { fips: true, stateFips: true, countyName: true } }),
  ]);
  let attachedProperties = 0;
  let registeredMapCounties = 0;
  const seenSignalCounties = new Set<string>();
  for (const signal of signals) {
    if (seenSignalCounties.has(signal.fips)) continue;
    seenSignalCounties.add(signal.fips);
    const stateCode = stateCodeByFips[signal.stateFips];
    const countyName = signal.countyName.replace(/\s+(County|Parish|Borough|Census Area|Municipality)$/i, "").trim();
    if (!stateCode || !validateCountyIdentity({ stateCode, countyName, fipsCode: signal.fips }).valid) continue;
    await db.countySourceRegistry.upsert({ where: { fipsCode: signal.fips }, update: { stateCode, countyName }, create: { stateCode, countyName, fipsCode: signal.fips, nextReviewAt: now, coverageReason: "Created from a persisted U.S. Census Development Radar county; official local sources require verification." } });
    registeredMapCounties += 1;
  }
  for (const property of properties) {
    if (!property.marketFips || !property.county) continue;
    const identity = { stateCode: property.state.toUpperCase(), countyName: property.county.replace(/\s+County$/i, "").trim(), fipsCode: property.marketFips };
    if (!validateCountyIdentity(identity).valid) continue;
    const registry = await db.countySourceRegistry.upsert({ where: { fipsCode: identity.fipsCode }, update: { countyName: identity.countyName, stateCode: identity.stateCode }, create: { ...identity, nextReviewAt: now, coverageReason: "Created automatically from a Census-resolved active property; official sources require review." } });
    await db.property.update({ where: { id: property.id }, data: { countyRegistryId: registry.id } });
    attachedProperties += 1;
  }
  return { propertiesScanned: properties.length, attachedProperties, registeredMapCounties, unresolvedProjects: projects.length };
}

export async function upsertCountyRegistry(input: { stateCode: string; countyName: string; fipsCode: string; actor: string; manualSearchInstructions?: string }) {
  const identity = { stateCode: input.stateCode.toUpperCase(), countyName: input.countyName.trim(), fipsCode: input.fipsCode };
  const validation = validateCountyIdentity(identity);
  if (!validation.valid || !input.actor) throw new Error(`Invalid county identity: ${validation.errors.join(", ")}`);
  return getPrisma().countySourceRegistry.upsert({ where: { fipsCode: identity.fipsCode }, update: { stateCode: identity.stateCode, countyName: identity.countyName, manualSearchInstructions: input.manualSearchInstructions, reviewedBy: input.actor, reviewedAt: new Date() }, create: { ...identity, manualSearchInstructions: input.manualSearchInstructions, reviewedBy: input.actor, reviewedAt: new Date(), coverageReason: "County registered; official source coverage requires evidence." } });
}

export async function registerCountySource(input: { registryId: string; agencyName: string; agencyType: CountyAgencyType; officialUrl: string; delegationEvidenceUrl?: string; propertySearchUrl?: string; parcelGisUrl?: string; taxUrl?: string; recorderUrl?: string; termsUrl?: string; robotsUrl?: string; accessMethod: string; authenticationRequired: boolean; subscriptionRequired: boolean; automationStatus: CountyAutomationStatus; supportedSearches: string[]; availableFields: string[]; sourceConfidence: number; actor: string }) {
  if (!input.actor || input.sourceConfidence < 0 || input.sourceConfidence > 100) throw new Error("A reviewer and confidence from 0 through 100 are required.");
  const domain = officialDomain(input.officialUrl, input.delegationEvidenceUrl);
  for (const candidate of [input.propertySearchUrl, input.parcelGisUrl, input.taxUrl, input.recorderUrl, input.termsUrl, input.robotsUrl]) if (candidate) https(candidate);
  return getPrisma().$transaction(async (tx) => {
    const latest = await tx.countyOfficialSource.findFirst({ where: { registryId: input.registryId, agencyName: input.agencyName, agencyType: input.agencyType }, orderBy: { version: "desc" } });
    if (latest && !latest.supersededAt) await tx.countyOfficialSource.update({ where: { id: latest.id }, data: { supersededAt: new Date() } });
    const source = await tx.countyOfficialSource.create({ data: { registryId: input.registryId, version: (latest?.version ?? 0) + 1, agencyName: input.agencyName, agencyType: input.agencyType, officialDomain: domain, delegationEvidenceUrl: input.delegationEvidenceUrl, propertySearchUrl: input.propertySearchUrl, parcelGisUrl: input.parcelGisUrl, taxUrl: input.taxUrl, recorderUrl: input.recorderUrl, termsUrl: input.termsUrl, robotsUrl: input.robotsUrl, accessMethod: input.accessMethod, authenticationRequired: input.authenticationRequired, subscriptionRequired: input.subscriptionRequired, automationStatus: input.automationStatus, supportedSearches: input.supportedSearches, availableFields: input.availableFields, sourceConfidence: input.sourceConfidence, createdBy: input.actor } });
    await tx.auditLog.create({ data: { type: "county.source.versioned", summary: `Recorded ${input.agencyName} county source version ${source.version}.`, details: { registryId: input.registryId, sourceId: source.id, automationStatus: source.automationStatus } } });
    return source;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function recordCountySourceCheck(input: { sourceId: string; status: CountyCoverageStatus; retrievalMethod: string; httpStatus?: number; responseHash?: string; failureReason?: string; retryCount: number; checkedAt: Date }) {
  if (input.retryCount < 0 || input.retryCount > 3) throw new Error("County connector retries are bounded at three attempts.");
  return getPrisma().$transaction(async (tx) => {
    const check = await tx.countySourceCheck.create({ data: { ...input, circuitOpenUntil: input.status === "TEMPORARILY_UNAVAILABLE" && input.retryCount >= 3 ? new Date(input.checkedAt.getTime() + 60 * 60_000) : undefined } });
    const source = await tx.countyOfficialSource.findUniqueOrThrow({ where: { id: input.sourceId } });
    await tx.countySourceRegistry.update({ where: { id: source.registryId }, data: { coverageStatus: input.status, lastAccessibilityCheckAt: input.checkedAt, lastSuccessfulRunAt: input.status === "AUTOMATED" ? input.checkedAt : undefined, failureReason: input.failureReason, nextReviewAt: new Date(input.checkedAt.getTime() + (input.status === "AUTOMATED" ? 30 : 1) * 86_400_000) } });
    return check;
  });
}

export async function readCountyCoverage(filters: { status?: CountyCoverageStatus } = {}) {
  return getPrisma().countySourceRegistry.findMany({ where: filters.status ? { coverageStatus: filters.status } : undefined, include: { sources: { where: { supersededAt: null }, include: { checks: { orderBy: { checkedAt: "desc" }, take: 1 } } }, _count: { select: { properties: true, developerProjects: true, campaignCoverage: true } } }, orderBy: [{ stateCode: "asc" }, { countyName: "asc" }] });
}

export async function readCountyManualReviewQueue(limit = 100) {
  const db = getPrisma();
  const [entityMatches, observations, inaccessible] = await Promise.all([
    db.countyEntityMatch.findMany({ where: { status: { in: ["PROPOSED", "NEEDS_MANUAL_VERIFICATION", "CONFLICTED"] } }, include: { source: { include: { registry: true } }, developer: { select: { companyName: true } }, property: { select: { address: true } } }, orderBy: { observedAt: "asc" }, take: limit }),
    db.countyFactObservation.findMany({ where: { status: { in: ["NEEDS_MANUAL_VERIFICATION", "CONFLICTED", "EXPIRED"] } }, include: { source: { include: { registry: true } }, property: { select: { address: true } }, developerProject: { select: { address: true } } }, orderBy: { observedAt: "asc" }, take: limit }),
    db.countySourceRegistry.findMany({ where: { coverageStatus: { in: ["MANUAL_ONLY", "RESTRICTED", "PAYWALLED", "TEMPORARILY_UNAVAILABLE", "NOT_FOUND", "NEEDS_REVIEW"] } }, orderBy: [{ nextReviewAt: "asc" }, { stateCode: "asc" }], take: limit }),
  ]);
  return { entityMatches, observations, inaccessible };
}
