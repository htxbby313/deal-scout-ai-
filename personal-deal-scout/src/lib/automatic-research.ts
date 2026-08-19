import "server-only";

import { getPrisma } from "@/lib/prisma";
import { enqueueDeveloperResearch, runAutomaticDeveloperResearchBatch } from "@/lib/developer-research";
import { enqueuePropertyResearch, runAutomaticPropertyResearchBatch } from "@/lib/property-research";
import { runCensusPermitResearch } from "@/lib/government-research";
import { importHudReoCounty, HUD_REO_SOURCE } from "@/lib/hud-reo";

const REFRESH_DAYS = 7;

export async function ensureAutomaticResearchBacklog(limit = 250) {
  const db = getPrisma();
  const cutoff = new Date(Date.now() - REFRESH_DAYS * 86_400_000);
  const safeLimit = Math.max(1, Math.min(limit, 1000));
  const [properties, developers] = await Promise.all([
    db.property.findMany({ where: { opportunityStatus: { not: "REJECTED" }, researchRuns: { none: { status: { in: ["QUEUED", "RUNNING"] } } }, OR: [{ researchRuns: { none: {} } }, { researchRuns: { none: { startedAt: { gte: cutoff } } } }] }, select: { id: true }, orderBy: { updatedAt: "asc" }, take: safeLimit }),
    db.developer.findMany({ where: { active: true, researchRuns: { none: { status: { in: ["QUEUED", "RUNNING"] } } }, OR: [{ lastResearchedAt: null }, { lastResearchedAt: { lt: cutoff } }] }, select: { id: true }, orderBy: { updatedAt: "asc" }, take: safeLimit }),
  ]);
  const [propertyRuns, developerRuns] = await Promise.all([
    Promise.all(properties.map(({ id }) => enqueuePropertyResearch(id))),
    Promise.all(developers.map(({ id }) => enqueueDeveloperResearch(id))),
  ]);
  return { propertiesQueued: propertyRuns.length, developersQueued: developerRuns.length };
}

export async function runAutomaticResearchCycle() {
  const queued = await ensureAutomaticResearchBacklog();
  const [properties, developers] = await Promise.all([runAutomaticPropertyResearchBatch(5), runAutomaticDeveloperResearchBatch(10)]);
  const government = await runAutomaticGovernmentResearch();
  return { queued, properties, developers, government };
}

async function runAutomaticGovernmentResearch() {
  const db = getPrisma();
  const cutoff = new Date(Date.now() - REFRESH_DAYS * 86_400_000);
  const latestCensus = await db.governmentResearchRun.findFirst({ where: { source: "U.S. Census Building Permits Survey", status: "COMPLETED" }, orderBy: { finishedAt: "desc" } });
  let census: { status: "fresh" | "completed" | "failed"; error?: string } = { status: "fresh" };
  if (!latestCensus?.finishedAt || latestCensus.finishedAt < cutoff) {
    try { await runCensusPermitResearch(); census = { status: "completed" }; }
    catch (error) { census = { status: "failed", error: error instanceof Error ? error.message : "Census research failed." }; }
  }
  const markets = await db.marketSignal.findMany({ orderBy: [{ capturedAt: "desc" }, { rank: "asc" }], distinct: ["fips"], select: { fips: true }, take: 5 });
  const hud = [];
  for (const market of markets) {
    const latest = await db.governmentResearchRun.findFirst({ where: { source: HUD_REO_SOURCE, period: market.fips, status: "COMPLETED" }, orderBy: { finishedAt: "desc" } });
    if (latest?.finishedAt && latest.finishedAt >= cutoff) continue;
    try { hud.push({ fips: market.fips, status: "completed" as const, result: await importHudReoCounty(market.fips) }); }
    catch (error) { hud.push({ fips: market.fips, status: "failed" as const, error: error instanceof Error ? error.message : "HUD research failed." }); }
  }
  return { census, hud };
}
