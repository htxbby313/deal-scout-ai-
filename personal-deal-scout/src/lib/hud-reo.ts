import "server-only";

import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { fetchWithRetry } from "@/lib/research-runtime";
import { routeForeclosure } from "@/lib/foreclosure-routing";

export const HUD_REO_SOURCE = "HUD FHA Single Family REO";
export const HUD_REO_LAYER = "https://egis.hud.gov/arcgis/rest/services/cpdmaps/HudSfReo/MapServer/1";
const CENSUS_COUNTIES = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1";
const MAX_RESPONSE_BYTES = 2_000_000;
const stateAbbreviations: Record<string, string> = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY","72":"PR"};

const hudFeatureSchema = z.object({ attributes: z.object({
  OBJECTID: z.number().int(), CASE_NUM: z.string().min(1), CASE_STEP_NUMBER: z.literal(6), ADDRESS: z.string().min(3), CITY: z.string().min(2), STATE_CODE: z.string().length(2), DISPLAY_ZIP_CODE: z.union([z.number(), z.string()]), DATE_ACQUIRED: z.number().nullable(), MAP_LATITUDE: z.number(), MAP_LONGITUDE: z.number(),
}) });
const hudResponseSchema = z.object({ features: z.array(hudFeatureSchema).max(1000) });

export type HudReoRecord = z.infer<typeof hudFeatureSchema>["attributes"];

async function officialJson(url: URL, init?: RequestInit) {
  const response = await fetchWithRetry(url, { ...init, cache: "no-store", attempts: 3, timeoutMs: 20_000, headers: { "User-Agent": "DealScoutAI/1.0 public-record-research", ...init?.headers } });
  if (!response.ok) throw new Error(`Official data request failed with HTTP ${response.status}.`);
  if (Number(response.headers.get("content-length") ?? 0) > MAX_RESPONSE_BYTES) throw new Error("Official data response exceeded the safe size limit.");
  const text = await response.text();
  if (new TextEncoder().encode(text).length > MAX_RESPONSE_BYTES) throw new Error("Official data response exceeded the safe size limit.");
  return JSON.parse(text) as unknown;
}

export function hudRecordSourceUrl(objectId: number) {
  const url = new URL(`${HUD_REO_LAYER}/query`);
  url.search = new URLSearchParams({ objectIds: String(objectId), outFields: "*", returnGeometry: "false", f: "pjson" }).toString();
  return url.toString();
}

async function fetchCountyListings(fips: string, state: string) {
  const countyUrl = new URL(`${CENSUS_COUNTIES}/query`);
  countyUrl.search = new URLSearchParams({ where: `GEOID='${fips}'`, outFields: "GEOID", returnGeometry: "true", outSR: "4326", geometryPrecision: "4", f: "json" }).toString();
  const county = z.object({ features: z.array(z.object({ geometry: z.object({ rings: z.array(z.array(z.array(z.number()).length(2))).min(1) }) })).length(1) }).parse(await officialJson(countyUrl));
  const form = new URLSearchParams({ where: `CASE_STEP_NUMBER=6 AND STATE_CODE='${state}'`, geometry: JSON.stringify(county.features[0].geometry), geometryType: "esriGeometryPolygon", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "OBJECTID,CASE_NUM,CASE_STEP_NUMBER,ADDRESS,CITY,STATE_CODE,DISPLAY_ZIP_CODE,DATE_ACQUIRED,MAP_LATITUDE,MAP_LONGITUDE", returnGeometry: "false", resultRecordCount: "1000", f: "json" });
  const hudUrl = new URL(`${HUD_REO_LAYER}/query`);
  return hudResponseSchema.parse(await officialJson(hudUrl, { method: "POST", body: form, headers: { "Content-Type": "application/x-www-form-urlencoded" } })).features.map((feature) => feature.attributes);
}

function dateFromEpoch(value: number | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : undefined;
}

export async function importHudReoCounty(fips: string) {
  if (!/^\d{5}$/.test(fips)) throw new Error("A valid five-digit county FIPS is required.");
  const state = stateAbbreviations[fips.slice(0, 2)];
  if (!state) throw new Error("HUD REO import is unavailable for this state or territory.");
  const db = getPrisma();
  const signal = await db.marketSignal.findFirst({ where: { fips }, orderBy: { capturedAt: "desc" } });
  if (!signal) throw new Error("This county is not in the persisted Development Radar.");
  const activeRun = await db.governmentResearchRun.findFirst({ where: { source: HUD_REO_SOURCE, period: fips, status: "RUNNING", startedAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
  if (activeRun) throw new Error("A HUD REO import is already running for this county.");
  const run = await db.governmentResearchRun.create({ data: { source: HUD_REO_SOURCE, status: "RUNNING", period: fips } });
  try {
    const countyListings = await fetchCountyListings(fips, state);
    const capturedAt = new Date();
    const result = await db.$transaction(async (tx) => {
      let created = 0; let refreshed = 0; let skipped = 0; const liveIds: string[] = [];
      for (const record of countyListings) {
        const address = record.ADDRESS.trim(); const zipCode = String(record.DISPLAY_ZIP_CODE).padStart(5, "0");
        const sourceUrl = hudRecordSourceUrl(record.OBJECTID);
        const routing = routeForeclosure({ ownerName: "U.S. Department of Housing and Urban Development", sourceName: HUD_REO_SOURCE, sourceUrl });
        const evidence = { city: record.CITY.trim(), state: record.STATE_CODE, ownerName: "U.S. Department of Housing and Urban Development", latitude: record.MAP_LATITUDE, longitude: record.MAP_LONGITUDE, marketFips: fips, opportunityStatus: "GOVERNMENT_SALE" as const, sourceName: HUD_REO_SOURCE, sourceUrl, sourceRecordDate: dateFromEpoch(record.DATE_ACQUIRED), lastVerifiedAt: capturedAt, confidence: 90, notes: `HUD FHA case ${record.CASE_NUM}. Public status step 6 observed ${capturedAt.toISOString().slice(0, 10)}. HUD acquisition date is the source record date, not a current listing date. Acquisition route: ${routing.route}. Routing status: ${routing.status}. Next action: ${routing.nextAction}. Blockers: ${routing.blockers.join("; ") || "none"}. Asking price, authorized bid channel, bidder period, and broker contact were not published in this layer.` };
        const existing = await tx.property.findUnique({ where: { address_zipCode: { address, zipCode } } });
        if (!existing) { const property = await tx.property.create({ data: { address, zipCode, ...evidence } }); liveIds.push(property.id); created += 1; }
        else if (existing.sourceName === HUD_REO_SOURCE) { await tx.property.update({ where: { id: existing.id }, data: evidence }); liveIds.push(existing.id); refreshed += 1; }
        else skipped += 1;
      }
      const stale = await tx.property.updateMany({ where: { marketFips: fips, sourceName: HUD_REO_SOURCE, opportunityStatus: "GOVERNMENT_SALE", ...(liveIds.length ? { id: { notIn: liveIds } } : {}) }, data: { opportunityStatus: "NEEDS_VERIFICATION" } });
      await tx.governmentResearchRun.update({ where: { id: run.id }, data: { status: "COMPLETED", recordsFound: countyListings.length, finishedAt: capturedAt } });
      await tx.auditLog.create({ data: { type: "research.hud_reo", summary: `Verified ${countyListings.length} HUD REO listing(s) in ${signal.countyName}; created ${created}, refreshed ${refreshed}, retired ${stale.count}.`, details: { fips, countyListingsFound: countyListings.length, created, refreshed, skipped, retired: stale.count, hudLayer: HUD_REO_LAYER, countyAuthority: CENSUS_COUNTIES } } });
      return { created, refreshed, skipped, retired: stale.count };
    });
    return { found: countyListings.length, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "HUD REO import failed.";
    await db.governmentResearchRun.update({ where: { id: run.id }, data: { status: "FAILED", error: message, finishedAt: new Date() } });
    throw new Error(message);
  }
}

export const __hudTestables = { hudFeatureSchema, hudResponseSchema, dateFromEpoch };
