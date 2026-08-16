import "server-only";

import { getPrisma } from "@/lib/prisma";

const CENSUS_SOURCE = "U.S. Census Building Permits Survey";
const COUNTY_BASE_URL = "https://www2.census.gov/econ/bps/County";
const states: Record<string, string> = {
  "01":"Alabama","02":"Alaska","04":"Arizona","05":"Arkansas","06":"California","08":"Colorado","09":"Connecticut","10":"Delaware","11":"District of Columbia","12":"Florida","13":"Georgia","15":"Hawaii","16":"Idaho","17":"Illinois","18":"Indiana","19":"Iowa","20":"Kansas","21":"Kentucky","22":"Louisiana","23":"Maine","24":"Maryland","25":"Massachusetts","26":"Michigan","27":"Minnesota","28":"Mississippi","29":"Missouri","30":"Montana","31":"Nebraska","32":"Nevada","33":"New Hampshire","34":"New Jersey","35":"New Mexico","36":"New York","37":"North Carolina","38":"North Dakota","39":"Ohio","40":"Oklahoma","41":"Oregon","42":"Pennsylvania","44":"Rhode Island","45":"South Carolina","46":"South Dakota","47":"Tennessee","48":"Texas","49":"Utah","50":"Vermont","51":"Virginia","53":"Washington","54":"West Virginia","55":"Wisconsin","56":"Wyoming","72":"Puerto Rico"
};

export const governmentSources = [
  { name: CENSUS_SOURCE, purpose: "Ranks counties by current residential permit activity and year-over-year momentum.", url: "https://www.census.gov/construction/bps/" },
  { name: "HUD Homes and Multifamily Sales", purpose: "Official federal property and multifamily foreclosure sale listings.", url: "https://www.hud.gov/helping-americans/homes-for-sale" },
  { name: "GSA Auctions", purpose: "Active federal real-property auctions and government surplus sales.", url: "https://www.gsaauctions.gov/" },
  { name: "SEC EDGAR", purpose: "Public-company filings used to verify acquisitions and development activity.", url: "https://www.sec.gov/search-filings" },
] as const;

type CountyPermit = { fips: string; stateFips: string; countyFips: string; countyName: string; stateName: string; units: number; value: bigint };

function csvLine(line: string) {
  const fields: string[] = []; let field = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) { const character = line[index]; if (character === '"') quoted = !quoted; else if (character === "," && !quoted) { fields.push(field.trim()); field = ""; } else field += character; }
  fields.push(field.trim()); return fields;
}
function integer(value: string | undefined) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0; }
function parseCountyPermits(text: string): CountyPermit[] {
  return text.split(/\r?\n/).slice(3).filter(Boolean).map(csvLine).map((row) => {
    const stateFips = row[1]?.padStart(2, "0") ?? ""; const countyFips = row[2]?.padStart(3, "0") ?? "";
    const units = integer(row[7]) + integer(row[10]) + integer(row[13]) + integer(row[16]);
    const value = BigInt(integer(row[8]) + integer(row[11]) + integer(row[14]) + integer(row[17]));
    return { fips: `${stateFips}${countyFips}`, stateFips, countyFips, countyName: row[5]?.trim() || "Unknown County", stateName: states[stateFips] || `State FIPS ${stateFips}`, units, value };
  }).filter((row) => row.fips.length === 5 && row.units >= 0);
}
function fileUrl(period: string) { return `${COUNTY_BASE_URL}/co${period.slice(2)}y.txt`; }
async function fetchPeriod(period: string) {
  const url = fileUrl(period);
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "DealScoutAI/1.0 public-record-research" } });
  if (!response.ok) return null;
  return { url, records: parseCountyPermits(await response.text()) };
}
function candidatePeriods(today = new Date()) {
  const periods: string[] = [];
  for (let offset = 1; offset <= 4; offset += 1) { const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1)); periods.push(`${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`); }
  return periods;
}

export async function runCensusPermitResearch() {
  const db = getPrisma();
  const run = await db.governmentResearchRun.create({ data: { source: CENSUS_SOURCE, status: "RUNNING" } });
  try {
    let current: Awaited<ReturnType<typeof fetchPeriod>> = null; let period = "";
    for (const candidate of candidatePeriods()) { current = await fetchPeriod(candidate); if (current) { period = candidate; break; } }
    if (!current) throw new Error("Census has not published a readable recent county permit file.");
    const priorPeriod = `${Number(period.slice(0, 4)) - 1}${period.slice(4)}`;
    const prior = await fetchPeriod(priorPeriod);
    if (!prior) throw new Error(`The Census comparison file for ${priorPeriod} was unavailable.`);
    const previous = new Map(prior.records.map((record) => [record.fips, record]));
    const ranked = current.records.map((record) => { const priorUnits = previous.get(record.fips)?.units ?? 0; const growthPct = priorUnits ? ((record.units - priorUnits) / priorUnits) * 100 : record.units ? 100 : 0; const momentum = record.units + Math.max(0, record.units - priorUnits) * 2; return { ...record, priorUnits, growthPct, momentum }; }).filter((record) => record.units >= 10).sort((a, b) => b.momentum - a.momentum || b.units - a.units).slice(0, 150);
    await db.$transaction(async (tx) => {
      for (const [index, signal] of ranked.entries()) await tx.marketSignal.upsert({ where: { source_fips_period: { source: CENSUS_SOURCE, fips: signal.fips, period } }, update: { currentUnits: signal.units, priorUnits: signal.priorUnits, growthPct: signal.growthPct, currentValue: signal.value, rank: index + 1, sourceUrl: current.url, capturedAt: new Date() }, create: { source: CENSUS_SOURCE, fips: signal.fips, stateFips: signal.stateFips, countyFips: signal.countyFips, countyName: signal.countyName, stateName: signal.stateName, period, currentUnits: signal.units, priorUnits: signal.priorUnits, growthPct: signal.growthPct, currentValue: signal.value, rank: index + 1, sourceUrl: current.url } });
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

export async function readGovernmentResearch() {
  const db = getPrisma();
  const [latestRun, signals] = await Promise.all([db.governmentResearchRun.findFirst({ orderBy: { createdAt: "desc" } }), db.marketSignal.findMany({ orderBy: [{ period: "desc" }, { rank: "asc" }], take: 150 })]);
  return { latestRun: latestRun ? { ...latestRun, startedAt: latestRun.startedAt.toISOString(), finishedAt: latestRun.finishedAt?.toISOString(), createdAt: latestRun.createdAt.toISOString() } : null, signals: signals.map((signal) => ({ ...signal, currentValue: signal.currentValue.toString(), capturedAt: signal.capturedAt.toISOString() })) };
}

export const __governmentTestables = { parseCountyPermits, candidatePeriods };
