import "server-only";
import { getPrisma } from "@/lib/prisma";
import { fetchWithRetry } from "@/lib/research-runtime";

const CENSUS_SOURCE = "U.S. Census Building Permits Survey";
const COUNTY_BASE_URL = "https://www2.census.gov/econ/bps/County";
const MAX_FILE_BYTES = 2_000_000;
const states: Record<string, string> = {"01":"Alabama","02":"Alaska","04":"Arizona","05":"Arkansas","06":"California","08":"Colorado","09":"Connecticut","10":"Delaware","11":"District of Columbia","12":"Florida","13":"Georgia","15":"Hawaii","16":"Idaho","17":"Illinois","18":"Indiana","19":"Iowa","20":"Kansas","21":"Kentucky","22":"Louisiana","23":"Maine","24":"Maryland","25":"Massachusetts","26":"Michigan","27":"Minnesota","28":"Mississippi","29":"Missouri","30":"Montana","31":"Nebraska","32":"Nevada","33":"New Hampshire","34":"New Jersey","35":"New Mexico","36":"New York","37":"North Carolina","38":"North Dakota","39":"Ohio","40":"Oklahoma","41":"Oregon","42":"Pennsylvania","44":"Rhode Island","45":"South Carolina","46":"South Dakota","47":"Tennessee","48":"Texas","49":"Utah","50":"Vermont","51":"Virginia","53":"Washington","54":"West Virginia","55":"Wisconsin","56":"Wyoming","72":"Puerto Rico"};

export const governmentSources = [
  { name: CENSUS_SOURCE, purpose: "Ranks counties by current residential permit activity and year-over-year momentum.", url: "https://www.census.gov/construction/bps/", status: "Connected" },
  { name: "HUD FHA Single Family REO", purpose: "Imports publicly listed step-6 federal REO properties and verifies county geography with Census TIGERweb.", url: "https://egis.hud.gov/arcgis/rest/services/cpdmaps/HudSfReo/MapServer/1", status: "Connected" },
  { name: "GSA Auctions", purpose: "Active federal real-property auctions and government surplus sales.", url: "https://www.gsaauctions.gov/", status: "Queued" },
  { name: "SEC EDGAR", purpose: "Public-company filings used to verify acquisitions and development activity.", url: "https://www.sec.gov/search-filings", status: "Queued" },
] as const;

type CountyPermit = { period: string; fips: string; stateFips: string; countyFips: string; countyName: string; stateName: string; units: number; value: bigint };

function csvLine(line: string) {
  const fields: string[] = []; let field = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { fields.push(field.trim()); field = ""; }
    else field += character;
  }
  if (quoted) throw new Error("Census county permit file contains an unterminated quoted field.");
  fields.push(field.trim()); return fields;
}

function integer(value: string | undefined) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0; }

function* textLines(text: string) {
  let start = 0;
  for (let index = 0; index <= text.length; index += 1) {
    if (index < text.length && text[index] !== "\n") continue;
    const end = index > start && text[index - 1] === "\r" ? index - 1 : index;
    yield text.slice(start, end);
    start = index + 1;
  }
}

function parseCountyPermits(text: string, expectedPeriod?: string): CountyPermit[] {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) throw new Error("Census county permit file exceeded the safe size limit.");
  const lines = textLines(text);
  const heading = csvLine(lines.next().value ?? "").map((value) => value.toLowerCase());
  const labels = csvLine(lines.next().value ?? "").map((value) => value.toLowerCase());
  if (heading[0] !== "survey" || labels[0] !== "date" || labels[1] !== "state" || labels[2] !== "county" || labels[5] !== "name") throw new Error("Census county permit file header was not recognized.");
  lines.next();
  const records: CountyPermit[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = csvLine(line);
    if (row.length < 18 || !/^\d{6}$/.test(row[0] ?? "")) throw new Error("Census county permit file contained an invalid county row.");
    const period = row[0];
    if (expectedPeriod && period !== expectedPeriod) throw new Error(`Census county permit file reported ${period}, not ${expectedPeriod}.`);
    const stateFips = row[1]?.padStart(2, "0") ?? ""; const countyFips = row[2]?.padStart(3, "0") ?? "";
    const units = integer(row[7]) + integer(row[10]) + integer(row[13]) + integer(row[16]);
    const value = BigInt(integer(row[8]) + integer(row[11]) + integer(row[14]) + integer(row[17]));
    const record = { period, fips: `${stateFips}${countyFips}`, stateFips, countyFips, countyName: row[5]?.trim() || "Unknown County", stateName: states[stateFips] || `State FIPS ${stateFips}`, units, value };
    if (/^\d{5}$/.test(record.fips) && record.stateFips !== "72") records.push(record);
  }
  if (!records.length) throw new Error("Census county permit file contained no county records.");
  return records;
}

function rankCountyPermits(current: CountyPermit[], prior: CountyPermit[]) {
  const previous = new Map(prior.map((record) => [record.fips, record]));
  return current.map((record) => {
    const priorUnits = previous.get(record.fips)?.units ?? null;
    const growthPct = priorUnits && priorUnits > 0 ? ((record.units - priorUnits) / priorUnits) * 100 : null;
    const momentum = record.units + (priorUnits === null ? 0 : Math.max(0, record.units - priorUnits) * 2);
    return { ...record, priorUnits, growthPct, momentum };
  }).filter((record) => record.units >= 10).sort((a, b) => b.momentum - a.momentum || b.units - a.units).slice(0, 150);
}

function fileUrl(period: string) { return `${COUNTY_BASE_URL}/co${period.slice(2)}y.txt`; }
async function fetchPeriod(period: string) {
  const url = fileUrl(period);
  const response = await fetchWithRetry(url, { cache: "no-store", attempts: 3, timeoutMs: 20_000, headers: { "User-Agent": "DealScoutAI/1.0 public-record-research" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Census county permit request failed with HTTP ${response.status}.`);
  if (Number(response.headers.get("content-length") ?? 0) > MAX_FILE_BYTES) throw new Error("Census county permit file exceeded the safe size limit.");
  return { url, records: parseCountyPermits(await response.text(), period) };
}

function candidatePeriods(today = new Date()) {
  const periods: string[] = [];
  for (let offset = 1; offset <= 4; offset += 1) { const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1)); periods.push(`${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`); }
  return periods;
}

export async function runCensusPermitResearch() {
  const db = getPrisma();
  const activeRun = await db.governmentResearchRun.findFirst({ where: { source: CENSUS_SOURCE, status: "RUNNING", startedAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
  if (activeRun) throw new Error("A Census permit scan is already running.");
  const run = await db.governmentResearchRun.create({ data: { source: CENSUS_SOURCE, status: "RUNNING" } });
  try {
    let current: Awaited<ReturnType<typeof fetchPeriod>> = null; let period = "";
    for (const candidate of candidatePeriods()) { current = await fetchPeriod(candidate); if (current) { period = candidate; break; } }
    if (!current) throw new Error("Census has not published a readable recent county permit file.");
    const priorPeriod = `${Number(period.slice(0, 4)) - 1}${period.slice(4)}`;
    const prior = await fetchPeriod(priorPeriod);
    if (!prior) throw new Error(`The Census comparison file for ${priorPeriod} was unavailable.`);
    const ranked = rankCountyPermits(current.records, prior.records);
    await db.$transaction(async (tx) => {
      await tx.marketSignal.deleteMany({ where: { source: CENSUS_SOURCE, period } });
      await tx.marketSignal.createMany({ data: ranked.map((signal, index) => ({ source: CENSUS_SOURCE, fips: signal.fips, stateFips: signal.stateFips, countyFips: signal.countyFips, countyName: signal.countyName, stateName: signal.stateName, period, currentUnits: signal.units, priorUnits: signal.priorUnits, growthPct: signal.growthPct, currentValue: signal.value, rank: index + 1, sourceUrl: current.url })) });
      await tx.governmentResearchRun.update({ where: { id: run.id }, data: { status: "COMPLETED", period, recordsFound: ranked.length, finishedAt: new Date() } });
      await tx.auditLog.create({ data: { type: "research.census_permits", summary: `Ranked ${ranked.length} counties from Census permit data for ${period}.`, details: { period, currentSource: current.url, priorSource: prior.url } } });
    });
    return { period, recordsFound: ranked.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Government research failed.";
    await db.governmentResearchRun.update({ where: { id: run.id }, data: { status: "FAILED", error: message, finishedAt: new Date() } });
    throw new Error(message);
  }
}

export async function readGovernmentResearch(options: { listingPage?: number; listingPageSize?: number } = {}) {
  const db = getPrisma();
  const listingPageSize = Math.max(1, Math.min(options.listingPageSize ?? 250, 500));
  const listingPage = Math.max(1, options.listingPage ?? 1);
  const listingWhere = { latitude: { not: null }, longitude: { not: null }, opportunityStatus: { not: "REJECTED" as const } };
  const [latestRun, latestCompletedRun, listings, listingCount, countyCoverage] = await Promise.all([
    db.governmentResearchRun.findFirst({ where: { source: CENSUS_SOURCE }, orderBy: { createdAt: "desc" } }),
    db.governmentResearchRun.findFirst({ where: { source: CENSUS_SOURCE, status: "COMPLETED", period: { not: null } }, orderBy: { createdAt: "desc" } }),
    db.property.findMany({ where: listingWhere, select: { id: true, address: true, city: true, state: true, zipCode: true, county: true, neighborhood: true, latitude: true, longitude: true, estimatedValue: true, marketFips: true }, orderBy: { id: "asc" }, skip: (listingPage - 1) * listingPageSize, take: listingPageSize }),
    db.property.count({ where: listingWhere }),
    db.countySourceRegistry.findMany({ select: { fipsCode: true, coverageStatus: true, coverageReason: true, lastAccessibilityCheckAt: true, nextReviewAt: true } }),
  ]);
  const signals = latestCompletedRun?.period ? await db.marketSignal.findMany({ where: { source: CENSUS_SOURCE, period: latestCompletedRun.period }, orderBy: { rank: "asc" }, take: 150 }) : [];
  const coverageByFips = new Map(countyCoverage.map((item) => [item.fipsCode, item]));
  return { dataPeriod: latestCompletedRun?.period ?? null, latestRun: latestRun ? { ...latestRun, startedAt: latestRun.startedAt.toISOString(), finishedAt: latestRun.finishedAt?.toISOString(), createdAt: latestRun.createdAt.toISOString() } : null, signals: signals.map((signal) => { const coverage = coverageByFips.get(signal.fips); return { ...signal, currentValue: signal.currentValue.toString(), capturedAt: signal.capturedAt.toISOString(), countyCoverageStatus: coverage?.coverageStatus ?? "NEEDS_REVIEW", countyCoverageReason: coverage?.coverageReason ?? "Official county source coverage has not been registered.", countyCoverageCheckedAt: coverage?.lastAccessibilityCheckAt?.toISOString() ?? null, countyCoverageNextReviewAt: coverage?.nextReviewAt?.toISOString() ?? null }; }), listingPagination: { page: listingPage, pageSize: listingPageSize, total: listingCount, pages: Math.max(1, Math.ceil(listingCount / listingPageSize)) }, listings: listings.flatMap((listing) => listing.latitude === null || listing.longitude === null ? [] : [{ ...listing, county: listing.county ?? undefined, neighborhood: listing.neighborhood ?? undefined, marketFips: listing.marketFips ?? undefined, estimatedValue: listing.estimatedValue ?? undefined, latitude: listing.latitude, longitude: listing.longitude }]) };
}

export const __governmentTestables = { parseCountyPermits, rankCountyPermits, candidatePeriods };
