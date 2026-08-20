import "server-only";

import { getPrisma } from "@/lib/prisma";
import { researchOfficialPropertySources } from "@/lib/official-property-sources";
import { HUD_REO_SOURCE } from "@/lib/hud-reo";

export const PROPERTY_RESEARCH_VERSION = 3;

const TOPICS = [
  ["LISTING", "Current listing or opportunity source"],
  ["PHOTOS", "Property photos"],
  ["LOCATION", "Mapped location"],
  ["PRICE", "Current asking price"],
  ["CONTACT", "Seller or broker contact"],
  ["OWNERSHIP", "Recorded ownership"],
  ["TAX", "Tax and assessed value"],
  ["ZONING", "Zoning and permitted use"],
  ["FLOOD", "Flood hazard"],
  ["UTILITIES", "Utility availability"],
  ["ACCESS", "Legal and physical access"],
  ["COMPS", "Comparable land or property sales"],
  ["PARCEL", "Parcel identity and legal description"],
  ["LIENS", "Known lien or encumbrance indicators"],
  ["EASEMENTS", "Recorded easement indicators"],
  ["COVENANTS", "Restrictive covenant indicators"],
  ["HISTORIC", "Historic or demolition restriction indicators"],
  ["ENVIRONMENTAL", "Wetland and environmental indicators"],
  ["DIMENSIONS", "Lot dimensions and frontage"],
] as const;

type Finding = {
  topic: string;
  label: string;
  value?: string;
  status: "VERIFIED" | "NOT_FOUND" | "CONFLICT" | "NEEDS_MANUAL_VERIFICATION";
  sourceName?: string;
  sourceUrl?: string;
  confidence?: number;
  notes?: string;
};

type DiscoveredMedia = { url: string; sourceUrl: string; sourceName: string; altText: string };

export function hasSufficientResearchEvidence(findings: Iterable<Pick<Finding, "topic" | "status">>, opportunityStatus?: string) {
  const items = [...findings];
  if (items.some((finding) => finding.status === "CONFLICT")) return false;
  const verified = new Set(items.filter((finding) => finding.status === "VERIFIED").map((finding) => finding.topic));
  const identifiable = ["LISTING", "OWNERSHIP", "PARCEL"].some((topic) => verified.has(topic));
  const actionable = opportunityStatus === "GOVERNMENT_SALE" || ["PRICE", "CONTACT", "TAX", "ZONING", "FLOOD"].some((topic) => verified.has(topic));
  return verified.has("LOCATION") && identifiable && actionable;
}

export async function enqueuePropertyResearch(propertyId: string) {
  const db = getPrisma();
  const property = await db.property.findUnique({ where: { id: propertyId }, select: { id: true, address: true, opportunityStatus: true } });
  if (!property) throw new Error("Property was not found.");
  if (property.opportunityStatus === "REJECTED") throw new Error("Retired properties cannot be queued for automatic research.");
  const existing = await db.propertyResearchRun.findFirst({ where: { propertyId, status: { in: ["QUEUED", "RUNNING"] } }, orderBy: { startedAt: "desc" } });
  if (existing) return existing;
  const queued = await db.propertyResearchRun.create({ data: { propertyId, status: "QUEUED", researchVersion: PROPERTY_RESEARCH_VERSION } });
  await db.auditLog.create({ data: { type: "research.property_dossier", summary: `Queued automatic public-source research for ${property.address}.`, details: { propertyId, runId: queued.id, trigger: "automatic" } } });
  return queued;
}

function safePublicUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Research sources must use HTTPS.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) throw new Error("Private network sources are not allowed.");
  return url;
}

async function fetchHtml(raw: string) {
  const url = safePublicUrl(raw);
  const response = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "DealScoutAI/1.0 source-backed-property-research", Accept: "text/html,application/xhtml+xml" } });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) throw new Error(`Source returned ${response.status || "an unsupported response"}.`);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > 2_000_000) throw new Error("Source page exceeded the 2 MB research limit.");
  const html = (await response.text()).slice(0, 2_000_000);
  return { html, finalUrl: response.url || url.toString() };
}

function meta(html: string, key: string) {
  const tags = html.match(/<meta\s[^>]*>/gi) || [];
  for (const tag of tags) {
    const property = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (property?.toLowerCase() !== key.toLowerCase()) continue;
    const content = tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
    if (content) return content.replaceAll("&amp;", "&");
  }
}

function imageUrls(html: string, baseUrl: string) {
  const candidates = [meta(html, "og:image"), meta(html, "og:image:url"), meta(html, "twitter:image")].filter(Boolean) as string[];
  return [...new Set(candidates.map((value) => {
    try { return new URL(value, baseUrl).toString(); } catch { return ""; }
  }).filter((value) => value.startsWith("https://")))];
}

function listingImageUrls(html: string, baseUrl: string, address: string) {
  const addressTerms = address.toLowerCase().split(/\s+/).filter((term) => term.length > 2);
  const matches: string[] = [];
  for (const tag of html.match(/<img\s[^>]*>/gi) || []) {
    const alt = tag.match(/alt\s*=\s*["']([^"']*)["']/i)?.[1]?.toLowerCase() || "";
    if (!addressTerms.some((term) => alt.includes(term))) continue;
    const src = tag.match(/(?:src|data-src)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (src) matches.push(src);
  }
  const jsonImages = [...html.matchAll(/["'](?:image|contentUrl)["']\s*:\s*["'](https:\/\/[^"']+)["']/gi)].map((match) => match[1]);
  return [...new Set([...imageUrls(html, baseUrl), ...matches, ...jsonImages].map((value) => {
    try { return new URL(value.replaceAll("\\/", "/").replaceAll("&amp;", "&"), baseUrl).toString(); } catch { return ""; }
  }).filter((value) => value.startsWith("https://")))].slice(0, 12);
}

function phoneNumbers(html: string) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  const matches = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) || [];
  return [...new Set(matches.map((phone) => phone.trim()))];
}

function normalizedWords(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function pageMatchesProperty(html: string, property: { address: string; city: string; state: string; zipCode: string }) {
  const page = normalizedWords(html).join(" ");
  const address = normalizedWords(property.address);
  const streetNumber = address.find((word) => /^\d+[a-z]?$/.test(word));
  const streetWords = address.filter((word) => word.length > 2 && !/^(street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|highway|hwy)$/.test(word));
  const locationMatches = [property.city, property.zipCode].some((value) => value && page.includes(normalizedWords(value).join(" ")));
  return Boolean(streetNumber && page.includes(streetNumber) && streetWords.some((word) => page.includes(word)) && locationMatches);
}

async function censusGeocode(property: { address: string; city: string; state: string; zipCode: string }) {
  const endpoint = new URL("https://geocoding.geo.census.gov/geocoder/geographies/address");
  endpoint.search = new URLSearchParams({ street: property.address, city: property.city, state: property.state, zip: property.zipCode, benchmark: "Public_AR_Current", vintage: "Current_Current", format: "json" }).toString();
  const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "DealScoutAI/1.0 source-backed-property-research" } });
  if (!response.ok) throw new Error(`Census Geocoder returned ${response.status}.`);
  const payload = await response.json() as { result?: { addressMatches?: Array<{ matchedAddress?: string; coordinates?: { x?: number; y?: number }; geographies?: { Counties?: Array<{ NAME?: string; GEOID?: string }> } }> } };
  const match = payload.result?.addressMatches?.[0];
  return match?.coordinates?.x !== undefined && match.coordinates.y !== undefined ? { address: match.matchedAddress || "Census address match", longitude: match.coordinates.x, latitude: match.coordinates.y, county: match.geographies?.Counties?.[0]?.NAME, fips: match.geographies?.Counties?.[0]?.GEOID, sourceUrl: endpoint.toString() } : null;
}

async function openStreetMapGeocode(property: { address: string; city: string; state: string; zipCode: string }) {
  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.search = new URLSearchParams({ q: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`, countrycodes: "us", addressdetails: "1", format: "jsonv2", limit: "1" }).toString();
  const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "DealScoutAI/1.0 property-research" } });
  if (!response.ok) throw new Error(`OpenStreetMap geocoder returned ${response.status}.`);
  const [match] = await response.json() as Array<{ lat?: string; lon?: string; display_name?: string; address?: { county?: string; neighbourhood?: string; suburb?: string } }>;
  const latitude = Number(match?.lat); const longitude = Number(match?.lon);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { address: match.display_name || "OpenStreetMap address match", latitude, longitude, county: match.address?.county, neighborhood: match.address?.neighbourhood || match.address?.suburb, fips: undefined, sourceUrl: endpoint.toString() } : null;
}

export async function researchProperty(propertyId: string, queuedRunId?: string) {
  const db = getPrisma();
  const property = await db.property.findUniqueOrThrow({ where: { id: propertyId } });
  const existingFindings = new Map((await db.propertyResearchFinding.findMany({ where: { propertyId } })).map((finding) => [finding.topic, finding]));
  const queuedRun = queuedRunId ? await db.propertyResearchRun.findFirst({ where: { id: queuedRunId, propertyId, status: "QUEUED" } }) : await db.propertyResearchRun.findFirst({ where: { propertyId, status: "QUEUED" }, orderBy: { startedAt: "asc" } });
  const run = queuedRun ? await db.propertyResearchRun.update({ where: { id: queuedRun.id }, data: { status: "RUNNING", startedAt: new Date(), error: null, researchVersion: PROPERTY_RESEARCH_VERSION } }) : await db.propertyResearchRun.create({ data: { propertyId, status: "RUNNING", researchVersion: PROPERTY_RESEARCH_VERSION } });
  const findings = new Map<string, Finding>();
  const media: DiscoveredMedia[] = [];
  const errors: string[] = [];
  const discoveredPhones: Array<{ phone: string; sourceUrl: string; sourceName: string }> = [];
  let geocode: Awaited<ReturnType<typeof censusGeocode>> = null;
  let sourcesChecked = 0;

  if (property.sourceName === HUD_REO_SOURCE && property.opportunityStatus === "GOVERNMENT_SALE" && property.sourceUrl && property.lastVerifiedAt) {
    findings.set("LISTING", { topic: "LISTING", label: "Current listing or opportunity source", value: `HUD FHA REO inventory verified ${property.lastVerifiedAt.toISOString().slice(0, 10)}`, status: "VERIFIED", sourceName: HUD_REO_SOURCE, sourceUrl: property.sourceUrl, confidence: 90, notes: "Imported directly from HUD's current FHA REO ArcGIS inventory; price and availability terms require the published HUD sales channel." });
    findings.set("OWNERSHIP", { topic: "OWNERSHIP", label: "Recorded ownership", value: property.ownerName, status: "VERIFIED", sourceName: HUD_REO_SOURCE, sourceUrl: property.sourceUrl, confidence: 85, notes: "HUD identifies the property as FHA REO inventory. A title professional must still confirm current record title and encumbrances." });
  }

  const sourceUrls = [...new Set([property.sourceUrl, property.verificationSourceUrl].filter(Boolean) as string[])];
  for (const sourceUrl of sourceUrls) {
    if (property.sourceName === HUD_REO_SOURCE && sourceUrl === property.sourceUrl) continue;
    sourcesChecked += 1;
    try {
      const { html, finalUrl } = await fetchHtml(sourceUrl);
      const sourceName = new URL(finalUrl).hostname.replace(/^www\./, "");
      const title = meta(html, "og:title") || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
      const subjectMatched = pageMatchesProperty(html, property);
      if (subjectMatched) {
        findings.set("LISTING", { topic: "LISTING", label: "Current listing or opportunity source", value: title || "Public source matched the property address", status: "VERIFIED", sourceName, sourceUrl: finalUrl, confidence: title ? 85 : 75, notes: "The public source responded and matched the property address during this run." });
        for (const [position, url] of listingImageUrls(html, finalUrl, property.address).entries()) media.push({ url, sourceUrl: finalUrl, sourceName, altText: `${property.address} verified-source photo ${position + 1}` });
        for (const phone of phoneNumbers(html)) discoveredPhones.push({ phone, sourceUrl: finalUrl, sourceName });
      } else errors.push(`${sourceUrl}: source responded but did not match the property address.`);
    } catch (error) {
      errors.push(`${sourceUrl}: ${error instanceof Error ? error.message : "source failed"}`);
    }
  }

  try {
    sourcesChecked += 1;
    geocode = await censusGeocode(property);
  } catch (error) { errors.push(`Census Geocoder: ${error instanceof Error ? error.message : "lookup failed"}`); }
  if (!geocode) try { geocode = await openStreetMapGeocode(property); } catch (error) { errors.push(`OpenStreetMap Geocoder: ${error instanceof Error ? error.message : "lookup failed"}`); }
  if (geocode) findings.set("LOCATION", { topic: "LOCATION", label: "Mapped location", value: `${geocode.latitude.toFixed(6)}, ${geocode.longitude.toFixed(6)} — ${geocode.address}`, status: "VERIFIED", sourceName: geocode.sourceUrl.includes("openstreetmap") ? "OpenStreetMap Nominatim" : "U.S. Census Geocoder", sourceUrl: geocode.sourceUrl, confidence: 80, notes: "Geocoder coordinates are address estimates, not a parcel survey." });

  if (geocode) {
    const official = await researchOfficialPropertySources({
      address: property.address,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
      county: property.county || geocode.county,
      latitude: geocode.latitude,
      longitude: geocode.longitude,
    });
    sourcesChecked += official.sourcesChecked;
    errors.push(...official.errors);
    for (const finding of official.findings) findings.set(finding.topic, finding);
  }

  if (media.length) findings.set("PHOTOS", { topic: "PHOTOS", label: "Property photos", value: `${media.length} verified-source image${media.length === 1 ? "" : "s"} found`, status: "VERIFIED", sourceName: media[0].sourceName, sourceUrl: media[0].sourceUrl, confidence: 80, notes: "Images came from a responding public source page that matched the property address. Usage rights must still be reviewed before external distribution." });
  if (property.estimatedValue && property.verificationSourceUrl) findings.set("PRICE", { topic: "PRICE", label: "Current asking price", value: `$${property.estimatedValue.toLocaleString("en-US")}`, status: "VERIFIED", sourceName: "Dated property verification", sourceUrl: property.verificationSourceUrl, confidence: property.confidence });
  const foundPhone = property.contactPhone ? null : discoveredPhones[0];
  const contactPhone = property.contactPhone || foundPhone?.phone;
  if (contactPhone && (property.verificationSourceUrl || foundPhone)) findings.set("CONTACT", { topic: "CONTACT", label: "Seller or broker phone", value: [property.contactName, contactPhone, property.contactEmail].filter(Boolean).join(" · "), status: "VERIFIED", sourceName: foundPhone?.sourceName || "Dated property verification", sourceUrl: foundPhone?.sourceUrl || property.verificationSourceUrl || undefined, confidence: property.contactPhone ? property.confidence : 70, notes: foundPhone ? "Phone was extracted from the saved listing source and should be rechecked when the listing changes." : undefined });

  for (const [topic, label] of TOPICS) if (!findings.has(topic)) {
    const previous = existingFindings.get(topic);
    findings.set(topic, { topic, label, value: previous?.value || undefined, status: "NEEDS_MANUAL_VERIFICATION", sourceName: previous?.sourceName || undefined, sourceUrl: previous?.sourceUrl || undefined, confidence: 0, notes: previous?.status === "VERIFIED" ? "Previously verified evidence was not reconfirmed during the current automatic refresh." : topic === "PHOTOS" ? "Integrated verified source pages did not expose a usable property image." : "Integrated sources did not return enough evidence during this run." });
  }
  const geocodedNeighborhood = geocode && "neighborhood" in geocode && typeof geocode.neighborhood === "string" ? geocode.neighborhood : undefined;

  await db.$transaction(async (tx) => {
    if (foundPhone || geocode) await tx.property.update({ where: { id: propertyId }, data: { contactPhone: contactPhone || undefined, contactUrl: foundPhone?.sourceUrl || undefined, latitude: geocode?.latitude, longitude: geocode?.longitude, county: property.county || geocode?.county, marketFips: geocode && "fips" in geocode ? geocode.fips : undefined, neighborhood: property.neighborhood || geocodedNeighborhood } });
    for (const finding of findings.values()) await tx.propertyResearchFinding.upsert({ where: { propertyId_topic: { propertyId, topic: finding.topic } }, update: { ...finding, observedAt: new Date() }, create: { propertyId, ...finding } });
    for (const [position, item] of media.entries()) await tx.propertyMedia.upsert({ where: { propertyId_url: { propertyId, url: item.url } }, update: { sourceUrl: item.sourceUrl, sourceName: item.sourceName, altText: item.altText, position }, create: { propertyId, ...item, position } });
    const manualNeeded = [...findings.values()].filter((item) => item.status !== "VERIFIED").length;
    const operationallyReady = hasSufficientResearchEvidence(findings.values(), property.opportunityStatus);
    await tx.propertyResearchRun.update({ where: { id: run.id }, data: { status: operationallyReady ? "COMPLETE" : "NEEDS_MANUAL_VERIFICATION", sourcesChecked, findingsFound: findings.size - manualNeeded, manualNeeded, error: errors.length ? errors.join("\n").slice(0, 4000) : null, finishedAt: new Date() } });
    await tx.auditLog.create({ data: { type: "research.property_dossier", summary: `Researched ${property.address}; ${findings.size - manualNeeded} verified topic(s), ${manualNeeded} routed to manual verification, ${media.length} image(s) found.`, details: { propertyId, runId: run.id, sourcesChecked, manualNeeded, mediaFound: media.length } } });
  });

  return { verified: [...findings.values()].filter((item) => item.status === "VERIFIED").length, manualNeeded: [...findings.values()].filter((item) => item.status !== "VERIFIED").length, mediaFound: media.length, errors };
}

export async function runQueuedPropertyResearch(runId: string) {
  const db = getPrisma();
  const run = await db.propertyResearchRun.findUnique({ where: { id: runId } });
  if (!run || run.status !== "QUEUED") return { status: "skipped" as const };
  try {
    const result = await researchProperty(run.propertyId, run.id);
    return { status: "completed" as const, propertyId: run.propertyId, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automatic public-source research failed.";
    await db.propertyResearchRun.updateMany({ where: { id: run.id, status: { in: ["QUEUED", "RUNNING"] } }, data: { status: "FAILED", error: message.slice(0, 4000), finishedAt: new Date() } });
    return { status: "failed" as const, propertyId: run.propertyId, error: message };
  }
}

export async function runAutomaticPropertyResearchBatch(limit = 2) {
  const db = getPrisma();
  const safeLimit = Math.max(1, Math.min(limit, 25));
  const staleCutoff = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  const abandonedCutoff = new Date(Date.now() - 30 * 60_000);
  await db.propertyResearchRun.updateMany({ where: { status: "RUNNING", startedAt: { lt: abandonedCutoff } }, data: { status: "QUEUED", error: "Recovered an interrupted automatic research run." } });
  const stale = await db.property.findMany({ where: { opportunityStatus: { not: "REJECTED" }, researchRuns: { none: { status: { in: ["QUEUED", "RUNNING"] } } }, OR: [{ researchRuns: { none: { researchVersion: { gte: PROPERTY_RESEARCH_VERSION } } } }, { researchRuns: { none: { startedAt: { gte: staleCutoff } } } }] }, select: { id: true }, orderBy: { updatedAt: "asc" }, take: safeLimit * 2 });
  for (const property of stale) await enqueuePropertyResearch(property.id);
  const queued = await db.propertyResearchRun.findMany({ where: { status: "QUEUED", property: { opportunityStatus: { not: "REJECTED" } } }, orderBy: { startedAt: "asc" }, take: safeLimit });
  const results: Awaited<ReturnType<typeof runQueuedPropertyResearch>>[] = [];
  for (let index = 0; index < queued.length; index += 5) results.push(...await Promise.all(queued.slice(index, index + 5).map((run) => runQueuedPropertyResearch(run.id))));
  return { processed: results.length, completed: results.filter((result) => result.status === "completed").length, failed: results.filter((result) => result.status === "failed").length, results };
}

export async function setPropertyMediaApproval(propertyId: string, mediaId: string, approved: boolean) {
  const db = getPrisma();
  const media = await db.propertyMedia.findFirst({ where: { id: mediaId, propertyId } });
  if (!media) throw new Error("Property image was not found.");
  return db.$transaction(async (tx) => {
    const updated = await tx.propertyMedia.update({ where: { id: mediaId }, data: { sendApproved: approved, reviewedAt: new Date() } });
    if (approved) await tx.propertyResearchFinding.upsert({ where: { propertyId_topic: { propertyId, topic: "PHOTOS" } }, update: { status: "VERIFIED", value: "At least one sourced image reviewed for the developer package", sourceName: media.sourceName, sourceUrl: media.sourceUrl, confidence: 90, observedAt: new Date(), notes: "A human approved the source image for developer sharing." }, create: { propertyId, topic: "PHOTOS", label: "Property photos", status: "VERIFIED", value: "At least one sourced image reviewed for the developer package", sourceName: media.sourceName, sourceUrl: media.sourceUrl, confidence: 90, notes: "A human approved the source image for developer sharing." } });
    await tx.auditLog.create({ data: { type: "property.media_reviewed", summary: `${approved ? "Approved" : "Removed approval from"} a sourced image for developer sharing.`, details: { propertyId, mediaId, approved, sourceUrl: media.sourceUrl } } });
    return updated;
  });
}

export async function addSourcedPropertyMedia(input: { propertyId: string; url: string; sourceUrl: string; sourceName: string; caption?: string }) {
  const db = getPrisma();
  const property = await db.property.findUnique({ where: { id: input.propertyId } });
  if (!property) throw new Error("Property was not found.");
  const url = safePublicUrl(input.url).toString();
  const sourceUrl = safePublicUrl(input.sourceUrl).toString();
  if (input.sourceName.trim().length < 2) throw new Error("A photo source name is required.");
  const media = await db.propertyMedia.upsert({ where: { propertyId_url: { propertyId: input.propertyId, url } }, update: { sourceUrl, sourceName: input.sourceName.trim(), caption: input.caption?.trim() || null, altText: `${property.address} sourced property photo`, sendApproved: false, reviewedAt: null }, create: { propertyId: input.propertyId, url, sourceUrl, sourceName: input.sourceName.trim(), caption: input.caption?.trim() || null, altText: `${property.address} sourced property photo` } });
  await db.auditLog.create({ data: { type: "property.media_added", summary: `Added a sourced image for ${property.address}; developer sharing remains unapproved.`, details: { propertyId: input.propertyId, mediaId: media.id, sourceUrl } } });
  return media;
}

export const __propertyResearchTestables = { safePublicUrl, meta, imageUrls, listingImageUrls, phoneNumbers, pageMatchesProperty, hasSufficientResearchEvidence };
