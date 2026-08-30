import "server-only";

import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { researchOfficialPropertySources } from "@/lib/official-property-sources";
import { HUD_REO_SOURCE } from "@/lib/hud-reo";
import {
  chunkedMap,
  fetchValidatedJson,
  fetchWithRetry,
  htmlToText,
  stableUnique,
  runWithResearchDeadline,
} from "@/lib/research-runtime";
import {
  ENFORMION_SOURCE_URL,
  enformionConfigured,
  researchPropertyWithEnformion,
} from "@/lib/enformion-property";
import { reserveEnformionLookup } from "@/lib/enformion-budget";
import { isSafePublicEvidenceUrl } from "@/lib/research-freshness";
import { researchPriorityScore } from "@/lib/domain";

export const PROPERTY_RESEARCH_VERSION = 5;

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

type DiscoveredMedia = {
  url: string;
  sourceUrl: string;
  sourceName: string;
  altText: string;
};

export function hasSufficientResearchEvidence(
  findings: Iterable<Pick<Finding, "topic" | "status">>,
  _opportunityStatus?: string,
) {
  const items = [...findings];
  if (!items.length) return false;
  return items.every((finding) =>
    ["VERIFIED", "NOT_FOUND"].includes(finding.status),
  );
}

export async function enqueuePropertyResearch(propertyId: string) {
  const db = getPrisma();
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { id: true, address: true, opportunityStatus: true },
  });
  if (!property) throw new Error("Property was not found.");
  if (property.opportunityStatus === "REJECTED")
    throw new Error(
      "Retired properties cannot be queued for automatic research.",
    );
  const existing = await db.propertyResearchRun.findFirst({
    where: { propertyId, status: { in: ["QUEUED", "RUNNING"] } },
    orderBy: { startedAt: "desc" },
  });
  if (existing) return existing;
  const queued = await db.propertyResearchRun.create({
    data: {
      propertyId,
      status: "QUEUED",
      researchVersion: PROPERTY_RESEARCH_VERSION,
    },
  });
  await db.auditLog.create({
    data: {
      type: "research.property_dossier",
      summary: `Queued automatic public-source research for ${property.address}.`,
      details: { propertyId, runId: queued.id },
    },
  });
  return queued;
}

function safePublicUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:")
    throw new Error("Research sources must use HTTPS.");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)
  )
    throw new Error("Private network sources are not allowed.");
  return url;
}

async function fetchHtml(raw: string) {
  const url = safePublicUrl(raw);
  const response = await fetchWithRetry(url, {
    cache: "no-store",
    redirect: "follow",
    attempts: 3,
    timeoutMs: 15_000,
    headers: {
      "User-Agent": "DealScoutAI/1.0 source-backed-property-research",
      Accept: "text/html",
    },
  });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html"))
    throw new Error(
      `Source returned ${response.status || "an unsupported response"}.`,
    );
  const length = Number(response.headers.get("content-length") || 0);
  if (length > 2_000_000)
    throw new Error("Source page exceeded the 2 MB research limit.");
  const html = (await response.text()).slice(0, 2_000_000);
  return { html, finalUrl: response.url || url.toString() };
}

function meta(html: string, key: string) {
  const tags = html.match(/<meta\s[^>]*>/gi) || [];
  for (const tag of tags) {
    const property = tag.match(
      /(?:property|name)\s*=\s*["']([^"']+)["']/i,
    )?.[1];
    if (property?.toLowerCase() !== key.toLowerCase()) continue;
    const content = tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
    if (content) return content.replaceAll("&amp;", "&");
  }
}

function imageUrls(html: string, baseUrl: string) {
  const candidates = [
    meta(html, "og:image"),
    meta(html, "og:image:url"),
    meta(html, "twitter:image"),
  ].filter(Boolean) as string[];
  return stableUnique(
    candidates
      .map((value) => {
        try {
          return new URL(value, baseUrl).toString();
        } catch {
          return "";
        }
      })
      .filter((value) => value.startsWith("https://")),
  ).slice(0, 12);
}

// FIX #4: Optimize image extraction with single pass, early termination
function listingImageUrls(html: string, baseUrl: string, address: string) {
  const matches: string[] = [];
  const seen = new Set<string>();
  const addressTerms = address
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2 && !/^(street|road|avenue|drive|lane|court|boulevard|highway)$/.test(term) && !/^\d+$/.test(term));
  const MAX_IMAGES = 12;
  let structuredNodes = 0;
  let structuredScripts = 0;
  const add = (raw?: string) => {
    if (!raw || matches.length >= MAX_IMAGES) return;
    try {
      const url = new URL(
        raw.replaceAll("\\/", "/").replaceAll("&amp;", "&"),
        baseUrl,
      ).toString();
      if (isSafePublicEvidenceUrl(url) && !seen.has(url)) {
        seen.add(url);
        matches.push(url);
      }
    } catch {
      /* Invalid image URLs are ignored. */
    }
  };
  const addStructuredImages = (value: unknown, depth = 0): void => {
    if (
      matches.length >= MAX_IMAGES ||
      value === null ||
      value === undefined ||
      depth > 8 ||
      structuredNodes >= 1_000
    )
      return;
    structuredNodes += 1;
    if (typeof value === "string") {
      add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) addStructuredImages(item, depth + 1);
      return;
    }
    if (typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (["Organization", "RealEstateAgent", "Person", "BreadcrumbList"].includes(String(record["@type"]))) return;
    for (const [key, child] of Object.entries(record)) {
      if (["image", "contentUrl", "@graph", "photo", "primaryImageOfPage", "thumbnailUrl"].includes(key))
        addStructuredImages(child, depth + 1);
      else if (child && typeof child === "object")
        addStructuredImages(child, depth + 1);
    }
    if (
      typeof record.url === "string" &&
      (record["@type"] === "ImageObject" || "contentUrl" in record)
    )
      add(record.url);
  };

  // Scan relevant tags once. JSON-LD is parsed as JSON instead of regex-scanning the full document.
  const tags =
    /<meta\b[^>]*>|<img\b[^>]*>|<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi;
  for (const match of html.matchAll(tags)) {
    if (matches.length >= MAX_IMAGES) break;
    const tag = match[0];
    if (/^<meta/i.test(tag)) {
      const key = tag
        .match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]
        ?.toLowerCase();
      if (["og:image", "og:image:url", "twitter:image"].includes(key ?? ""))
        add(tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1]);
    } else if (/^<img/i.test(tag)) {
      const alt =
        tag.match(/alt\s*=\s*["']([^"']*)["']/i)?.[1]?.toLowerCase() ?? "";
      const streetNumber = address.match(/^\s*(\d+[a-z]?)/i)?.[1]?.toLowerCase();
      if (addressTerms.some((term) => alt.includes(term)) && (!streetNumber || normalizedWords(alt).includes(streetNumber))) {
        const attribute = (name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
        // Lazy-loaded galleries often put a placeholder in src. Prefer the real image.
        const sourceSet = attribute("data-srcset") || attribute("srcset");
        const largest = sourceSet?.split(",").map((entry) => {
          const [url, size] = entry.trim().split(/\s+/);
          return { url, size: Number.parseFloat(size || "1") || 1 };
        }).sort((a, b) => b.size - a.size)[0]?.url;
        add(attribute("data-src") || attribute("data-lazy-src") || attribute("data-original") || largest || attribute("src"));
      }
    } else {
      const body = tag.match(/>([\s\S]*?)<\/script>/i)?.[1];
      structuredScripts += 1;
      if (structuredScripts > 20) break;
      if (body && body.length <= 256_000)
        try {
          addStructuredImages(JSON.parse(body));
        } catch {
          /* Untrusted malformed metadata is ignored. */
        }
    }
  }
  return matches;
}

function phoneNumbers(html: string) {
  const text = htmlToText(html);
  const matches =
    text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) || [];
  return stableUnique(matches.map((phone) => phone.trim()));
}

function normalizedWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const JSON_LD_SCRIPT_LIMIT = 20;
const JSON_LD_BYTES_LIMIT = 256_000;
const JSON_LD_DEPTH_LIMIT = 8;
const JSON_LD_NODE_LIMIT = 1_000;

function jsonLdAddressText(html: string) {
  const addressValues = new Map<string, string>();
  const wanted = new Set([
    "address",
    "streetaddress",
    "addresslocality",
    "addressregion",
    "postalcode",
  ]);
  let scripts = 0;
  let nodes = 0;
  const pattern =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const script of html.matchAll(pattern)) {
    scripts += 1;
    if (scripts > JSON_LD_SCRIPT_LIMIT) break;
    const body = script[1];
    if (body.length > JSON_LD_BYTES_LIMIT) continue;
    try {
      const visit = (value: unknown, key = "", depth = 0): void => {
        if (
          depth > JSON_LD_DEPTH_LIMIT ||
          nodes >= JSON_LD_NODE_LIMIT ||
          addressValues.size >= 5
        )
          return;
        nodes += 1;
        const normalizedKey = key.toLowerCase();
        if (typeof value === "string") {
          if (wanted.has(normalizedKey) && !addressValues.has(normalizedKey))
            addressValues.set(normalizedKey, value);
          return;
        }
        if (Array.isArray(value)) {
          for (const item of value) visit(item, key, depth + 1);
          return;
        }
        if (value && typeof value === "object")
          for (const [childKey, child] of Object.entries(value))
            visit(child, childKey, depth + 1);
      };
      visit(JSON.parse(body));
      if (
        addressValues.has("streetaddress") &&
        addressValues.has("postalcode") &&
        addressValues.has("addresslocality")
      )
        break;
    } catch {
      /* Malformed structured data cannot support an address match. */
    }
  }
  return [...addressValues.values()].join(" ");
}

function pageMatchesProperty(
  html: string,
  property: { address: string; city: string; state: string; zipCode: string },
) {
  const address = normalizedWords(property.address);
  const streetNumber = address.find((word) => /^\d+[a-z]?$/.test(word));
  const streetWords = address.filter(
    (word) =>
      word.length > 2 &&
      !/^(street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|highway|hwy)$/.test(
        word,
      ),
  );
  if (!streetNumber) return false;
  const page = normalizedWords(
    `${htmlToText(html)} ${jsonLdAddressText(html)}`,
  ).join(" ");
  const locationMatches = [property.city, property.zipCode].some(
    (value) => value && page.includes(normalizedWords(value).join(" ")),
  );
  if (!locationMatches) return false;
  return Boolean(
    page.includes(streetNumber) &&
    streetWords.some((word) => page.includes(word)),
  );
}

export async function enqueuePropertyResearchBatch(propertyIds: string[]) {
  if (!propertyIds.length) return [];
  const db = getPrisma();
  const allRuns: Array<{ id: string; propertyId: string }> = [];
  for (let offset = 0; offset < propertyIds.length; offset += 1000) {
    const chunk = stableUnique(propertyIds.slice(offset, offset + 1000));
    const runs = await db.$transaction(async (tx) => {
      const [properties, active] = await Promise.all([
        tx.property.findMany({
          where: { id: { in: chunk }, opportunityStatus: { not: "REJECTED" } },
          select: { id: true, address: true },
        }),
        tx.propertyResearchRun.findMany({
          where: {
            propertyId: { in: chunk },
            status: { in: ["QUEUED", "RUNNING"] },
          },
          select: { propertyId: true },
        }),
      ]);
      const activeIds = new Set(active.map((run) => run.propertyId));
      const queuedProperties = properties.filter(
        (property) => !activeIds.has(property.id),
      );
      const runs = await tx.propertyResearchRun.createManyAndReturn({
        data: queuedProperties.map((property) => ({
          propertyId: property.id,
          status: "QUEUED",
          researchVersion: PROPERTY_RESEARCH_VERSION,
        })),
        select: { id: true, propertyId: true },
      });
      const addresses = new Map(
        queuedProperties.map((property) => [property.id, property.address]),
      );
      if (runs.length)
        await tx.auditLog.createMany({
          data: runs.map((run) => ({
            type: "research.property_dossier",
            summary: `Queued automatic public-source research for ${addresses.get(run.propertyId) ?? "property"}.`,
            details: {
              propertyId: run.propertyId,
              runId: run.id,
              trigger: "automatic_batch",
            },
          })),
        });
      return runs;
    });
    allRuns.push(...runs);
  }
  return allRuns;
}

const censusGeocodeSchema = z.object({
  result: z
    .object({
      addressMatches: z
        .array(
          z.object({
            matchedAddress: z.string().optional(),
            coordinates: z.object({ x: z.number(), y: z.number() }),
            geographies: z
              .object({
                Counties: z
                  .array(z.object({ NAME: z.string().optional() }))
                  .optional(),
              })
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});
const openStreetMapSchema = z
  .array(
    z.object({
      lat: z.string(),
      lon: z.string(),
      display_name: z.string().optional(),
      address: z
        .object({
          county: z.string().optional(),
          neighbourhood: z.string().optional(),
          suburb: z.string().optional(),
        })
        .optional(),
    }),
  )
  .max(1);

async function censusGeocode(property: {
  address: string;
  city: string;
  state: string;
  zipCode: string;
}) {
  const endpoint = new URL(
    "https://geocoding.geo.census.gov/geocoder/geographies/address",
  );
  endpoint.search = new URLSearchParams({
    street: property.address,
    city: property.city,
    state: property.state,
    zip: property.zipCode,
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    format: "json",
  }).toString();
  const payload = await fetchValidatedJson(endpoint, censusGeocodeSchema, {
    cache: "no-store",
    attempts: 3,
    timeoutMs: 15_000,
    headers: {
      "User-Agent": "DealScoutAI/1.0 source-backed-property-research",
    },
  });
  const match = payload.result?.addressMatches?.[0];
  return match?.coordinates?.x !== undefined &&
    match.coordinates.y !== undefined
    ? {
        address: match.matchedAddress || "Census address match",
        longitude: match.coordinates.x,
        latitude: match.coordinates.y,
        county: match.geographies?.Counties?.[0]?.NAME,
      }
    : null;
}

async function openStreetMapGeocode(property: {
  address: string;
  city: string;
  state: string;
  zipCode: string;
}) {
  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.search = new URLSearchParams({
    q: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
    countrycodes: "us",
    addressdetails: "1",
    format: "jsonv2",
    limit: "1",
  }).toString();
  const [match] = await fetchValidatedJson(endpoint, openStreetMapSchema, {
    cache: "no-store",
    attempts: 3,
    timeoutMs: 15_000,
    headers: { "User-Agent": "DealScoutAI/1.0 property-research" },
  });
  const latitude = Number(match?.lat);
  const longitude = Number(match?.lon);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? {
        address: match.display_name || "OpenStreetMap address match",
        latitude,
        longitude,
        county: match.address?.county,
        neighborhood: match.address?.neighbourhood || match.address?.suburb,
      }
    : null;
}

export function propertyPhotoSourceUrls(input: {
  sourceUrl?: string | null;
  verificationSourceUrl?: string | null;
  findings: Array<{ topic: string; status: string; sourceUrl?: string | null }>;
}) {
  return stableUnique([
    input.sourceUrl,
    input.verificationSourceUrl,
    ...input.findings.filter((finding) => finding.status === "VERIFIED" && ["LISTING", "PHOTOS"].includes(finding.topic)).map((finding) => finding.sourceUrl),
  ].filter((url): url is string => typeof url === "string" && isSafePublicEvidenceUrl(url))).slice(0, 6);
}

export async function researchProperty(
  propertyId: string,
  queuedRunId?: string,
) {
  const db = getPrisma();
  const property = await db.property.findUniqueOrThrow({
    where: { id: propertyId },
  });
  const existingFindings = new Map(
    (await db.propertyResearchFinding.findMany({ where: { propertyId } })).map(
      (finding) => [finding.topic, finding],
    ),
  );
  const queuedRun = queuedRunId
    ? await db.propertyResearchRun.findFirst({
        where: { id: queuedRunId, propertyId, status: "QUEUED" },
      })
    : await db.propertyResearchRun.findFirst({
        where: { propertyId, status: "QUEUED" },
        orderBy: { startedAt: "desc" },
      });
  if (queuedRun && queuedRun.attemptCount >= queuedRun.maxAttempts) {
    await db.propertyResearchRun.update({
      where: { id: queuedRun.id },
      data: {
        status: "FAILED",
        exhausted: true,
        error: "Property research retry limit reached.",
        finishedAt: new Date(),
      },
    });
    await db.auditLog.create({
      data: {
        type: "research.property_dossier",
        summary: `Research retry limit reached for ${property.address}.`,
        details: {
          propertyId,
          runId: queuedRun.id,
          attemptCount: queuedRun.attemptCount,
          maxAttempts: queuedRun.maxAttempts,
        },
      },
    });
    throw new Error("Property research retry limit reached.");
  }
  const run = queuedRun
    ? await db.propertyResearchRun.update({
        where: { id: queuedRun.id },
        data: {
          status: "RUNNING",
          startedAt: new Date(),
          error: null,
          researchVersion: PROPERTY_RESEARCH_VERSION,
          attemptCount: { increment: 1 },
        },
      })
    : await db.propertyResearchRun.create({
        data: {
          propertyId,
          status: "RUNNING",
          researchVersion: PROPERTY_RESEARCH_VERSION,
          attemptCount: 1,
        },
      });
  const findings = new Map<string, Finding>();
  const media: DiscoveredMedia[] = [];
  const errors: string[] = [];
  const discoveredPhones: Array<{
    phone: string;
    sourceUrl: string;
    sourceName: string;
  }> = [];
  let geocode: Awaited<ReturnType<typeof censusGeocode>> = null;
  let sourcesChecked = 0;

  if (
    property.sourceName === HUD_REO_SOURCE &&
    property.opportunityStatus === "GOVERNMENT_SALE" &&
    property.sourceUrl &&
    property.lastVerifiedAt
  ) {
    findings.set("LISTING", {
      topic: "LISTING",
      label: "Current listing or opportunity source",
      value: `HUD FHA REO inventory verified ${property.lastVerifiedAt.toISOString().slice(0, 10)}`,
      status: "VERIFIED",
      sourceName: HUD_REO_SOURCE,
      sourceUrl: property.sourceUrl,
      confidence: 95,
    });
    findings.set("OWNERSHIP", {
      topic: "OWNERSHIP",
      label: "Recorded ownership",
      value: property.ownerName,
      status: "VERIFIED",
      sourceName: HUD_REO_SOURCE,
      sourceUrl: property.sourceUrl,
      confidence: 90,
    });
  }

  const sourceUrls = propertyPhotoSourceUrls({ ...property, findings: [...existingFindings.values()] });
  const seenMedia = new Set<string>();
  const listingDeadline = Date.now() + 45_000;
  for (const sourceUrl of sourceUrls) {
    if (Date.now() >= listingDeadline) {
      errors.push("Listing photo research reached its time limit; some sources were not checked.");
      break;
    }
    if (
      property.sourceName === HUD_REO_SOURCE &&
      sourceUrl === property.sourceUrl
    )
      continue;
    sourcesChecked += 1;
    try {
      const { html, finalUrl } = await runWithResearchDeadline(Math.min(listingDeadline, Date.now() + 7_000), () => fetchHtml(sourceUrl));
      const sourceName = new URL(finalUrl).hostname.replace(/^www\./, "");
      const title =
        meta(html, "og:title") ||
        html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
      const subjectMatched = pageMatchesProperty(html, property);
      if (subjectMatched) {
        findings.set("LISTING", {
          topic: "LISTING",
          label: "Current listing or opportunity source",
          value: title || "Public source matched the property address",
          status: "VERIFIED",
          sourceName,
          sourceUrl: finalUrl,
          confidence: 85,
        });
        for (const [position, url] of listingImageUrls(
          html,
          finalUrl,
          property.address,
        ).entries()) {
          if (seenMedia.has(url)) continue;
          seenMedia.add(url);
          media.push({
            url,
            sourceUrl: finalUrl,
            sourceName,
            altText: `${property.address} verified-source image ${position + 1}`,
          });
        }
        for (const phone of phoneNumbers(html))
          discoveredPhones.push({ phone, sourceUrl: finalUrl, sourceName });
      } else
        errors.push(
          `${sourceUrl}: source responded but did not match the property address.`,
        );
    } catch (error) {
      errors.push(
        `${sourceUrl}: ${error instanceof Error ? error.message : "source failed"}`,
      );
    }
  }

  try {
    sourcesChecked += 1;
    geocode = await censusGeocode(property);
  } catch (error) {
    errors.push(
      `Census Geocoder: ${error instanceof Error ? error.message : "lookup failed"}`,
    );
  }
  if (!geocode) {
    try {
      geocode = await openStreetMapGeocode(property);
    } catch (error) {
      errors.push(
        `OpenStreetMap Geocoder: ${error instanceof Error ? error.message : "lookup failed"}`,
      );
    }
  }
  if (geocode)
    findings.set("LOCATION", {
      topic: "LOCATION",
      label: "Mapped location",
      value: `${geocode.latitude.toFixed(6)}, ${geocode.longitude.toFixed(6)} — ${geocode.address}`,
      status: "VERIFIED",
      sourceName: "U.S. Census Bureau",
      sourceUrl: "https://geocoding.geo.census.gov",
      confidence: 90,
    });

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
    for (const finding of official.findings)
      findings.set(finding.topic, finding);
  }

  const needsPropertyRecords = [
    "OWNERSHIP",
    "PARCEL",
    "TAX",
    "ZONING",
    "DIMENSIONS",
    "UTILITIES",
  ].some((topic) => !findings.has(topic));
  let enformionOwner: string | undefined;
  if (needsPropertyRecords && enformionConfigured()) {
    try {
      const budget = await reserveEnformionLookup(propertyId);
      if (!budget.reserved) {
        errors.push(
          `EnformionGO: configured monthly lookup limit (${budget.limit}) reached for ${budget.month}.`,
        );
      } else {
        sourcesChecked += 1;
        const result = await researchPropertyWithEnformion(property);
        if (result?.matched) {
          enformionOwner = result.ownerNames[0];
          const evidence = {
            status: "VERIFIED" as const,
            sourceName: "EnformionGO PropertyV2",
            sourceUrl: ENFORMION_SOURCE_URL,
            confidence: 88,
            notes:
              "Licensed property-record evidence matched to the complete situs address. Confirm closing-critical facts with the county or title professional.",
          };
          if (result.ownerNames.length)
            findings.set("OWNERSHIP", {
              topic: "OWNERSHIP",
              label: "Recorded ownership",
              value: result.ownerNames.join(" · "),
              ...evidence,
            });
          if (result.apn || result.legalDescription)
            findings.set("PARCEL", {
              topic: "PARCEL",
              label: "Parcel identity and legal description",
              value: [
                result.apn && `APN ${result.apn}`,
                result.legalDescription,
              ]
                .filter(Boolean)
                .join(" · "),
              ...evidence,
            });
          if (
            result.assessedValue !== undefined ||
            result.taxAmount !== undefined
          )
            findings.set("TAX", {
              topic: "TAX",
              label: "Tax and assessed value",
              value: [
                result.assessedValue !== undefined &&
                  `Assessed $${result.assessedValue.toLocaleString("en-US")}${result.assessedYear ? ` (${result.assessedYear})` : ""}`,
                result.taxAmount !== undefined &&
                  `Tax $${result.taxAmount.toLocaleString("en-US")}${result.taxYear ? ` (${result.taxYear})` : ""}`,
              ]
                .filter(Boolean)
                .join(" · "),
              ...evidence,
            });
          if (result.zoning)
            findings.set("ZONING", {
              topic: "ZONING",
              label: "Zoning and permitted use",
              value: result.zoning,
              ...evidence,
            });
          if (result.dimensions)
            findings.set("DIMENSIONS", {
              topic: "DIMENSIONS",
              label: "Lot dimensions and frontage",
              value: result.dimensions,
              ...evidence,
            });
          if (result.utilities)
            findings.set("UTILITIES", {
              topic: "UTILITIES",
              label: "Utility availability",
              value: result.utilities,
              ...evidence,
            });
        } else
          errors.push(
            "EnformionGO: no exact address match was returned; no provider facts were saved.",
          );
      }
    } catch (error) {
      errors.push(
        `EnformionGO: ${error instanceof Error ? error.message : "lookup failed"}`,
      );
    }
  }

  if (media.length)
    findings.set("PHOTOS", {
      topic: "PHOTOS",
      label: "Property photos",
      value: `${media.length} verified-source image${media.length === 1 ? "" : "s"} found`,
      status: "VERIFIED",
      sourceName: media[0].sourceName,
      sourceUrl: media[0].sourceUrl,
      confidence: 80,
    });
  if (property.estimatedValue && property.verificationSourceUrl)
    findings.set("PRICE", {
      topic: "PRICE",
      label: "Current asking price",
      value: `$${property.estimatedValue.toLocaleString("en-US")}`,
      status: "VERIFIED",
      sourceName: "Verified source",
      sourceUrl: property.verificationSourceUrl,
      confidence: 85,
    });
  const foundPhone = property.contactPhone ? null : discoveredPhones[0];
  const contactPhone = property.contactPhone || foundPhone?.phone;
  if (contactPhone && (property.verificationSourceUrl || foundPhone))
    findings.set("CONTACT", {
      topic: "CONTACT",
      label: "Seller or broker phone",
      value: [property.contactName, contactPhone, property.contactEmail]
        .filter(Boolean)
        .join(" · "),
      status: "VERIFIED",
      sourceName: foundPhone?.sourceName || "Verified source",
      sourceUrl:
        foundPhone?.sourceUrl || property.verificationSourceUrl || undefined,
      confidence: 80,
    });

  for (const [topic, label] of TOPICS) {
    if (!findings.has(topic)) {
      findings.set(topic, {
        topic,
        label,
        value: "No supported public record found in the completed automated search.",
        status: sourcesChecked > 0 ? "NOT_FOUND" : "NEEDS_MANUAL_VERIFICATION",
        confidence: sourcesChecked > 0 ? 100 : 0,
        notes:
          sourcesChecked > 0
            ? "No evidence found is a completed research result. It does not verify the underlying fact or make the property actionable."
            : "No public source was successfully checked; retry or owner review is required.",
      });
    }
  }
  const geocodedNeighborhood =
    geocode &&
    "neighborhood" in geocode &&
    typeof geocode.neighborhood === "string"
      ? geocode.neighborhood
      : undefined;

  // FIX #5: Batch database operations instead of sequential upserts
  await db.$transaction(async (tx) => {
    if (foundPhone || geocode || enformionOwner)
      await tx.property.update({
        where: { id: propertyId },
        data: {
          ownerName: enformionOwner || undefined,
          contactPhone: contactPhone || undefined,
          contactUrl: foundPhone?.sourceUrl || undefined,
          latitude: geocode?.latitude || undefined,
          longitude: geocode?.longitude || undefined,
          neighborhood: geocodedNeighborhood || undefined,
          lastVerifiedAt: new Date(),
        },
      });

    // Batch upsert all findings at once
    const findingUpserts = [...findings.values()].map((finding) =>
      tx.propertyResearchFinding.upsert({
        where: { propertyId_topic: { propertyId, topic: finding.topic } },
        update: { ...finding, observedAt: new Date() },
        create: { propertyId, ...finding, observedAt: new Date() },
      }),
    );
    await Promise.all(findingUpserts);

    // Batch upsert all media items
    const mediaUpserts = media.map((item, position) =>
      tx.propertyMedia.upsert({
        where: { propertyId_url: { propertyId, url: item.url } },
        update: {
          sourceUrl: item.sourceUrl,
          sourceName: item.sourceName,
          altText: item.altText,
          position,
          discoveredAt: new Date(),
        },
        create: { propertyId, ...item, position, discoveredAt: new Date() },
      }),
    );
    await Promise.all(mediaUpserts);

    const verifiedCount = [...findings.values()].filter(
      (item) => item.status === "VERIFIED",
    ).length;
    const notFoundCount = [...findings.values()].filter(
      (item) => item.status === "NOT_FOUND",
    ).length;
    const manualNeeded = [...findings.values()].filter((item) =>
      ["CONFLICT", "NEEDS_MANUAL_VERIFICATION"].includes(item.status),
    ).length;
    const operationallyReady = hasSufficientResearchEvidence(
      findings.values(),
      property.opportunityStatus,
    );
    await tx.propertyResearchRun.update({
      where: { id: run.id },
      data: {
        status: operationallyReady ? "COMPLETE" : "NEEDS_MANUAL_VERIFICATION",
        sourcesChecked,
        findingsFound: verifiedCount,
        manualNeeded,
        error: errors.length ? errors.slice(0, 5).join(" | ") : null,
        finishedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        type: "research.property_dossier",
        summary: `Researched ${property.address}; ${verifiedCount} verified topic(s), ${notFoundCount} public-record searches returned no evidence, ${manualNeeded} routed to manual review.`,
        details: {
          propertyId,
          sourcesChecked,
          verified: verifiedCount,
          notFound: notFoundCount,
          errorCount: errors.length,
        },
      },
    });
  });

  return {
    verified: [...findings.values()].filter(
      (item) => item.status === "VERIFIED",
    ).length,
    manualNeeded: [...findings.values()].filter((item) =>
      ["CONFLICT", "NEEDS_MANUAL_VERIFICATION"].includes(item.status),
    ).length,
    mediaFound: media.length,
  };
}

export async function runQueuedPropertyResearch(runId: string) {
  const db = getPrisma();
  const run = await db.propertyResearchRun.findUnique({ where: { id: runId } });
  if (!run || run.status !== "QUEUED") return { status: "skipped" as const };
  try {
    const result = await researchProperty(run.propertyId, run.id);
    return {
      status: "completed" as const,
      propertyId: run.propertyId,
      ...result,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Automatic public-source research failed.";
    await db.propertyResearchRun.updateMany({
      where: { id: run.id, status: { in: ["QUEUED", "RUNNING"] } },
      data: {
        status: "FAILED",
        error: message.slice(0, 4000),
        finishedAt: new Date(),
      },
    });
    return {
      status: "failed" as const,
      propertyId: run.propertyId,
      error: message,
    };
  }
}

// FIX #1 & #2: Replace sequential loops with concurrent batching
export async function runAutomaticPropertyResearchBatch(limit = 2) {
  const db = getPrisma();
  const safeLimit = Math.max(1, Math.min(limit, 25));
  const staleCutoff = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  const abandonedCutoff = new Date(Date.now() - 30 * 60_000);

  // Recover abandoned runs
  const exhausted = await db.propertyResearchRun.findMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: abandonedCutoff },
      attemptCount: { gte: 3 },
      exhausted: false,
    },
    select: {
      id: true,
      propertyId: true,
      attemptCount: true,
      property: { select: { address: true } },
    },
    take: 25,
  });
  await Promise.all([
    db.propertyResearchRun.updateMany({
      where: {
        status: "RUNNING",
        startedAt: { lt: abandonedCutoff },
        attemptCount: { lt: 3 },
      },
      data: {
        status: "QUEUED",
        error: "Recovered an interrupted automatic research run.",
      },
    }),
    db.propertyResearchRun.updateMany({
      where: { id: { in: exhausted.map((run) => run.id) } },
      data: {
        status: "FAILED",
        exhausted: true,
        error:
          "Automatic research retry limit reached after repeated interruptions.",
        finishedAt: new Date(),
      },
    }),
    exhausted.length
      ? db.auditLog.createMany({
          data: exhausted.map((run) => ({
            type: "research.property_dossier",
            summary: `Research retry limit reached for ${run.property.address}.`,
            details: {
              propertyId: run.propertyId,
              runId: run.id,
              attemptCount: run.attemptCount,
              maxAttempts: 3,
            },
          })),
        })
      : Promise.resolve(),
  ]);

  // Find stale properties that need research
  const stale = await db.property.findMany({
    where: {
      opportunityStatus: { not: "REJECTED" },
      researchRuns: { none: { status: { in: ["QUEUED", "RUNNING"] } } },
      OR: [
        {
          researchRuns: {
            none: { researchVersion: { gte: PROPERTY_RESEARCH_VERSION } },
          },
        },
        {
          researchRuns: {
            some: { status: "COMPLETE", finishedAt: { lt: staleCutoff } },
          },
        },
      ],
    },
    select: {
      id: true,
      opportunityStatus: true,
      confidence: true,
      sourceUrl: true,
      verificationSourceUrl: true,
      verificationDate: true,
      estimatedValue: true,
      contactPhone: true,
      contactEmail: true,
      contactUrl: true,
    },
    take: safeLimit * 20,
  });

  stale.sort((a, b) => researchPriorityScore(b) - researchPriorityScore(a));

  // FIX #1: Batch enqueue all stale properties instead of sequential loop
  if (stale.length > 0) {
    await enqueuePropertyResearchBatch(stale.slice(0, safeLimit).map((property) => property.id));
  }

  // Fetch queued runs
  const queuedCandidates = await db.propertyResearchRun.findMany({
    where: {
      status: "QUEUED",
      property: { opportunityStatus: { not: "REJECTED" } },
    },
    include: { property: true },
    orderBy: { startedAt: "asc" },
    take: safeLimit * 20,
  });
  const queued = queuedCandidates
    .sort((a, b) => researchPriorityScore(b.property) - researchPriorityScore(a.property) || a.startedAt.getTime() - b.startedAt.getTime())
    .slice(0, safeLimit);

  const results = await chunkedMap(queued, 5, (run) =>
    runQueuedPropertyResearch(run.id),
  );

  return {
    processed: results.length,
    completed: results.filter((result) => result.status === "completed").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };
}

export async function setPropertyMediaApproval(
  propertyId: string,
  mediaId: string,
  approved: boolean,
  rightsStatus = "UNKNOWN",
  rightsEvidenceUrl?: string,
) {
  const db = getPrisma();
  const media = await db.propertyMedia.findFirst({
    where: { id: mediaId, propertyId },
  });
  if (!media) throw new Error("Property image was not found.");
  return db.$transaction(async (tx) => {
    const externallyEligible =
      [
        "OWNED",
        "LICENSED",
        "PERMISSION_DOCUMENTED",
        "EXTERNAL_APPROVED",
      ].includes(rightsStatus) &&
      (!["LICENSED", "PERMISSION_DOCUMENTED"].includes(rightsStatus) ||
        Boolean(rightsEvidenceUrl?.startsWith("https://")));
    const updated = await tx.propertyMedia.update({
      where: { id: mediaId },
      data: {
        sendApproved: approved && externallyEligible,
        rightsStatus: rightsStatus as never,
        rightsEvidenceUrl: rightsEvidenceUrl || null,
        externalApprovedAt: approved && externallyEligible ? new Date() : null,
        reviewedAt: new Date(),
      },
    });
    if (approved && externallyEligible)
      await tx.propertyResearchFinding.upsert({
        where: { propertyId_topic: { propertyId, topic: "PHOTOS" } },
        update: {
          status: "VERIFIED",
          value: "At least one sourced image reviewed and approved.",
        },
        create: {
          propertyId,
          topic: "PHOTOS",
          label: "Property photos",
          value: "At least one sourced image reviewed and approved.",
          status: "VERIFIED",
          sourceName: "Owner review",
          confidence: 100,
        },
      });
    await tx.auditLog.create({
      data: {
        type: "property.media_reviewed",
        summary: `${approved && externallyEligible ? "Approved" : "Kept blocked from"} a sourced image for developer sharing.`,
        details: {
          propertyId,
          mediaId,
          approved: approved && externallyEligible,
          rightsStatus,
          rightsEvidenceUrl: rightsEvidenceUrl || null,
        },
      },
    });
    return updated;
  });
}

export async function addSourcedPropertyMedia(input: {
  propertyId: string;
  url: string;
  sourceUrl: string;
  sourceName: string;
  caption?: string;
}) {
  const db = getPrisma();
  const property = await db.property.findUnique({
    where: { id: input.propertyId },
  });
  if (!property) throw new Error("Property was not found.");
  const url = safePublicUrl(input.url).toString();
  const sourceUrl = safePublicUrl(input.sourceUrl).toString();
  if (input.sourceName.trim().length < 2)
    throw new Error("A photo source name is required.");
  const media = await db.propertyMedia.upsert({
    where: { propertyId_url: { propertyId: input.propertyId, url } },
    update: {
      sourceUrl,
      sourceName: input.sourceName.trim(),
      caption: input.caption?.trim() || undefined,
    },
    create: {
      propertyId: input.propertyId,
      url,
      sourceUrl,
      sourceName: input.sourceName.trim(),
      caption: input.caption?.trim() || undefined,
      altText: input.caption || "Property media",
      kind: "LISTING_PHOTO",
    },
  });
  await db.auditLog.create({
    data: {
      type: "property.media_added",
      summary: `Added a sourced image for ${property.address}; developer sharing remains unapproved.`,
      details: {
        propertyId: input.propertyId,
        mediaId: media.id,
        sourceName: input.sourceName,
      },
    },
  });
  return media;
}

export const __propertyResearchTestables = {
  safePublicUrl,
  censusGeocodeSchema,
  openStreetMapSchema,
  meta,
  imageUrls,
  listingImageUrls,
  phoneNumbers,
  pageMatchesProperty,
  hasSufficientResearchEvidence,
};
