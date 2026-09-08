import "server-only";

import { getPrisma } from "@/lib/prisma";
import { DEVELOPER_RESEARCH_VERSION, enqueueDeveloperResearchBatch, runAutomaticDeveloperResearchBatch } from "@/lib/developer-research";
import { enqueuePropertyResearchBatch, PROPERTY_RESEARCH_VERSION, runAutomaticPropertyResearchBatch } from "@/lib/property-research";
import { runCensusPermitResearch } from "@/lib/government-research";
import { runWithResearchDeadline } from "@/lib/research-runtime";
import { runMotivatedSellerDiscovery } from "@/lib/motivated-seller-discovery";

const REFRESH_DAYS = 7;

export async function ensureAutomaticResearchBacklog(limit = 250) {
  const db = getPrisma();
  const cutoff = new Date(Date.now() - REFRESH_DAYS * 86_400_000);
  const safeLimit = Math.max(1, Math.min(limit, 1000));
  const [properties, developers] = await Promise.all([
    db.property.findMany({ where: { opportunityStatus: { not: "REJECTED" }, researchRuns: { none: { status: { in: ["QUEUED", "RUNNING"] } } }, OR: [{ researchRuns: { none: { researchVersion: { gte: PROPERTY_RESEARCH_VERSION } } } }, { researchRuns: { none: { startedAt: { gte: cutoff } } } }] }, select: { id: true }, orderBy: { updatedAt: "asc" }, take: safeLimit }),
    db.developer.findMany({ where: { active: true, researchRuns: { none: { status: { in: ["QUEUED", "RUNNING"] } } }, OR: [{ researchRuns: { none: { researchVersion: { gte: DEVELOPER_RESEARCH_VERSION } } } }, { lastResearchedAt: null }, { lastResearchedAt: { lt: cutoff } }] }, select: { id: true }, orderBy: { updatedAt: "asc" }, take: safeLimit }),
  ]);
  const [propertyRuns, developerRuns] = await Promise.all([
    enqueuePropertyResearchBatch(properties.map(({ id }) => id)),
    enqueueDeveloperResearchBatch(developers.map(({ id }) => id)),
  ]);
  return { propertiesQueued: propertyRuns.length, developersQueued: developerRuns.length };
}

export async function runAutomaticResearchCycle(options: { deadlineAt?: number } = {}) {
  const operation = async () => {
    const [government, discovery] = await Promise.all([
      runAutomaticGovernmentResearch(),
      runMotivatedSellerDiscovery().catch((error) => ({ status: "failed" as const, searched: 0, created: 0, references: 0, error: error instanceof Error ? error.message : "Motivated-seller discovery failed" })),
    ]);
    const queued = await ensureAutomaticResearchBacklog();
    const [properties, developers] = await Promise.all([runAutomaticPropertyResearchBatch(25), runAutomaticDeveloperResearchBatch(25)]);
    return { queued, properties, developers, government, discovery };
  };
  return options.deadlineAt ? runWithResearchDeadline(options.deadlineAt, operation) : operation();
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
  return { census, hud: [], ownerTargeting: "FSBO_DEFAULT_TAX_REPAIR_EQUITY_PRESSURE" as const };
}
