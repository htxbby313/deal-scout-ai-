import "server-only";

import { getPrisma } from "@/lib/prisma";

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

async function censusGeocode(property: { address: string; city: string; state: string; zipCode: string }) {
  const endpoint = new URL("https://geocoding.geo.census.gov/geocoder/locations/address");
  endpoint.search = new URLSearchParams({ street: property.address, city: property.city, state: property.state, zip: property.zipCode, benchmark: "Public_AR_Current", format: "json" }).toString();
  const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "DealScoutAI/1.0 source-backed-property-research" } });
  if (!response.ok) throw new Error(`Census Geocoder returned ${response.status}.`);
  const payload = await response.json() as { result?: { addressMatches?: Array<{ matchedAddress?: string; coordinates?: { x?: number; y?: number } }> } };
  const match = payload.result?.addressMatches?.[0];
  return match?.coordinates?.x !== undefined && match.coordinates.y !== undefined ? { address: match.matchedAddress || "Census address match", longitude: match.coordinates.x, latitude: match.coordinates.y, sourceUrl: endpoint.toString() } : null;
}

export async function researchProperty(propertyId: string) {
  const db = getPrisma();
  const property = await db.property.findUniqueOrThrow({ where: { id: propertyId } });
  const existingFindings = new Map((await db.propertyResearchFinding.findMany({ where: { propertyId } })).map((finding) => [finding.topic, finding]));
  const run = await db.propertyResearchRun.create({ data: { propertyId, status: "RUNNING" } });
  const findings = new Map<string, Finding>();
  const media: DiscoveredMedia[] = [];
  const errors: string[] = [];
  let sourcesChecked = 0;

  const sourceUrls = [...new Set([property.sourceUrl, property.verificationSourceUrl].filter(Boolean) as string[])];
  for (const sourceUrl of sourceUrls) {
    sourcesChecked += 1;
    try {
      const { html, finalUrl } = await fetchHtml(sourceUrl);
      const sourceName = new URL(finalUrl).hostname.replace(/^www\./, "");
      const title = meta(html, "og:title") || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
      findings.set("LISTING", { topic: "LISTING", label: "Current listing or opportunity source", value: title || "Source page responded", status: "VERIFIED", sourceName, sourceUrl, confidence: title ? 80 : 60, notes: "The source page responded during this run; availability still requires dated listing evidence." });
      for (const [position, url] of imageUrls(html, finalUrl).entries()) media.push({ url, sourceUrl, sourceName, altText: `${property.address} source photo ${position + 1}` });
    } catch (error) {
      errors.push(`${sourceUrl}: ${error instanceof Error ? error.message : "source failed"}`);
    }
  }

  try {
    sourcesChecked += 1;
    const location = await censusGeocode(property);
    if (location) findings.set("LOCATION", { topic: "LOCATION", label: "Mapped location", value: `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} — ${location.address}`, status: "VERIFIED", sourceName: "U.S. Census Geocoder", sourceUrl: location.sourceUrl, confidence: 80, notes: "Census coordinates are address-range estimates, not a parcel survey." });
  } catch (error) { errors.push(`Census Geocoder: ${error instanceof Error ? error.message : "lookup failed"}`); }

  if (media.length) findings.set("PHOTOS", { topic: "PHOTOS", label: "Property photos", value: `${media.length} source image${media.length === 1 ? "" : "s"} found`, status: "VERIFIED", sourceName: media[0].sourceName, sourceUrl: media[0].sourceUrl, confidence: 70, notes: "Images were exposed by the source page. Review subject match and usage rights before sending." });
  if (property.estimatedValue && property.verificationSourceUrl) findings.set("PRICE", { topic: "PRICE", label: "Current asking price", value: `$${property.estimatedValue.toLocaleString("en-US")}`, status: "VERIFIED", sourceName: "Dated property verification", sourceUrl: property.verificationSourceUrl, confidence: property.confidence });
  if (property.contactName && (property.contactPhone || property.contactEmail) && property.verificationSourceUrl) findings.set("CONTACT", { topic: "CONTACT", label: "Seller or broker contact", value: [property.contactName, property.contactPhone, property.contactEmail].filter(Boolean).join(" · "), status: "VERIFIED", sourceName: "Dated property verification", sourceUrl: property.verificationSourceUrl, confidence: property.confidence });

  for (const [topic, label] of TOPICS) if (!findings.has(topic)) {
    const previous = existingFindings.get(topic);
    if (previous?.status === "VERIFIED") findings.set(topic, { topic, label: previous.label, value: previous.value || undefined, status: "VERIFIED", sourceName: previous.sourceName || undefined, sourceUrl: previous.sourceUrl || undefined, confidence: previous.confidence, notes: previous.notes || undefined });
    else findings.set(topic, { topic, label, status: "NEEDS_MANUAL_VERIFICATION", confidence: 0, notes: topic === "PHOTOS" ? "Integrated source pages did not expose a usable property image." : "Integrated sources did not return enough evidence during this run." });
  }

  await db.$transaction(async (tx) => {
    for (const finding of findings.values()) await tx.propertyResearchFinding.upsert({ where: { propertyId_topic: { propertyId, topic: finding.topic } }, update: { ...finding, observedAt: new Date() }, create: { propertyId, ...finding } });
    for (const [position, item] of media.entries()) await tx.propertyMedia.upsert({ where: { propertyId_url: { propertyId, url: item.url } }, update: { sourceUrl: item.sourceUrl, sourceName: item.sourceName, altText: item.altText, position }, create: { propertyId, ...item, position } });
    const manualNeeded = [...findings.values()].filter((item) => item.status !== "VERIFIED").length;
    await tx.propertyResearchRun.update({ where: { id: run.id }, data: { status: manualNeeded ? "NEEDS_MANUAL_VERIFICATION" : "COMPLETE", sourcesChecked, findingsFound: findings.size - manualNeeded, manualNeeded, error: errors.length ? errors.join("\n").slice(0, 4000) : null, finishedAt: new Date() } });
    await tx.auditLog.create({ data: { type: "research.property_dossier", summary: `Researched ${property.address}; ${findings.size - manualNeeded} verified topic(s), ${manualNeeded} routed to manual verification, ${media.length} image(s) found.`, details: { propertyId, runId: run.id, sourcesChecked, manualNeeded, mediaFound: media.length } } });
  });

  return { verified: [...findings.values()].filter((item) => item.status === "VERIFIED").length, manualNeeded: [...findings.values()].filter((item) => item.status !== "VERIFIED").length, mediaFound: media.length, errors };
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

export const __propertyResearchTestables = { safePublicUrl, meta, imageUrls };
