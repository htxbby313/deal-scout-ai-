import "server-only";

import { getPrisma } from "@/lib/prisma";
import { DEVELOPER_RESEARCH_VERSION } from "@/lib/developer-research";
import { PROPERTY_RESEARCH_VERSION } from "@/lib/property-research";
import {
  AUTOMATIC_RESEARCH_TASK_TYPES,
  RESEARCH_MAX_ATTEMPTS,
  RESEARCH_STALE_AFTER_MS,
  researchRetryDecision,
  researchRetryDelayMs,
} from "@/lib/research-automation-policy";

const researchTaskTypes = [...AUTOMATIC_RESEARCH_TASK_TYPES];

export async function recoverAutomaticResearchWork(now = new Date()) {
  const db = getPrisma();
  const staleCutoff = new Date(now.getTime() - RESEARCH_STALE_AFTER_MS);

  const [staleTasks, failedTasks, approvalBlockedResearch] = await Promise.all([
    db.agentTask.findMany({
      where: { taskType: { in: researchTaskTypes }, status: "IN_PROGRESS", startedAt: { lt: staleCutoff } },
      select: { id: true, assignedAgentId: true, attemptCount: true },
      take: 50,
    }),
    db.agentTask.findMany({
      where: { taskType: { in: researchTaskTypes }, status: "FAILED", attemptCount: { lt: RESEARCH_MAX_ATTEMPTS } },
      select: { id: true, assignedAgentId: true, attemptCount: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
      take: 50,
    }),
    db.agentTask.findMany({
      where: { taskType: { in: researchTaskTypes }, status: "WAITING_FOR_APPROVAL" },
      select: { id: true, assignedAgentId: true },
      take: 50,
    }),
  ]);

  let requeued = 0;
  let exhausted = 0;
  let approvalReleased = 0;
  let dossierRetries = 0;

  for (const task of staleTasks) {
    const retry = task.attemptCount < RESEARCH_MAX_ATTEMPTS;
    await db.$transaction([
      db.agentTask.update({ where: { id: task.id }, data: {
        status: retry ? "QUEUED" : "FAILED",
        startedAt: null,
        ownerApprovalRequired: false,
        output: retry ? { recovery: "Recovered stale automatic research task." } : { error: "Automatic research retry limit reached after stale runs." },
      } }),
      db.agentRun.updateMany({ where: { taskId: task.id, status: "RUNNING" }, data: { status: "FAILED", error: "Run exceeded the automatic research time limit.", finishedAt: now } }),
      db.agentEvent.create({ data: {
        taskId: task.id,
        actorAgentId: task.assignedAgentId,
        type: retry ? "TASK_UPDATED" : "RUN_FAILED",
        summary: retry ? "Recovered stale automatic research for retry." : "Automatic research retry limit reached.",
      } }),
    ]);
    if (retry) requeued += 1; else exhausted += 1;
  }

  for (const task of failedTasks) {
    const decision = researchRetryDecision({ attemptCount: task.attemptCount, failedAt: task.updatedAt, now });
    if (!decision.retry) continue;
    await db.$transaction([
      db.agentTask.update({ where: { id: task.id }, data: { status: "QUEUED", startedAt: null, ownerApprovalRequired: false, output: { recovery: "Scheduled bounded automatic retry." } } }),
      db.agentEvent.create({ data: { taskId: task.id, actorAgentId: task.assignedAgentId, type: "TASK_UPDATED", summary: `Queued automatic research retry ${task.attemptCount + 1} of ${RESEARCH_MAX_ATTEMPTS}.` } }),
    ]);
    requeued += 1;
  }

  for (const task of approvalBlockedResearch) {
    await db.$transaction([
      db.agentTask.update({ where: { id: task.id }, data: { status: "QUEUED", ownerApprovalRequired: false, ownerApprovedAt: null, ownerApprovedBy: null, approvalReason: null } }),
      db.agentEvent.create({ data: { taskId: task.id, actorAgentId: task.assignedAgentId, type: "TASK_UPDATED", summary: "Released internal public-source research from per-task owner approval." } }),
    ]);
    approvalReleased += 1;
  }

  const retryCutoff = new Date(now.getTime() - researchRetryDelayMs(1));
  const dayCutoff = new Date(now.getTime() - 24 * 60 * 60_000);
  const [failedPropertyRuns, failedDeveloperRuns] = await Promise.all([
    db.propertyResearchRun.findMany({ where: { status: "FAILED", finishedAt: { lte: retryCutoff } }, orderBy: { finishedAt: "asc" }, take: 25 }),
    db.developerResearchRun.findMany({ where: { status: "FAILED", finishedAt: { lte: retryCutoff } }, orderBy: { finishedAt: "asc" }, take: 25 }),
  ]);

  for (const run of failedPropertyRuns) {
    const [active, recentFailures, property] = await Promise.all([
      db.propertyResearchRun.findFirst({ where: { propertyId: run.propertyId, status: { in: ["QUEUED", "RUNNING"] } }, select: { id: true } }),
      db.propertyResearchRun.count({ where: { propertyId: run.propertyId, status: "FAILED", startedAt: { gte: dayCutoff } } }),
      db.property.findUnique({ where: { id: run.propertyId }, select: { address: true, opportunityStatus: true } }),
    ]);
    if (active || !property || property.opportunityStatus === "REJECTED" || recentFailures >= RESEARCH_MAX_ATTEMPTS) continue;
    const retry = await db.propertyResearchRun.create({ data: { propertyId: run.propertyId, status: "QUEUED", researchVersion: PROPERTY_RESEARCH_VERSION } });
    await db.auditLog.create({ data: { type: "research.property_dossier", summary: `Queued bounded automatic retry for ${property.address}.`, details: { priorRunId: run.id, runId: retry.id, retry: recentFailures + 1 } } });
    dossierRetries += 1;
  }

  for (const run of failedDeveloperRuns) {
    const [active, recentFailures, developer] = await Promise.all([
      db.developerResearchRun.findFirst({ where: { developerId: run.developerId, status: { in: ["QUEUED", "RUNNING"] } }, select: { id: true } }),
      db.developerResearchRun.count({ where: { developerId: run.developerId, status: "FAILED", startedAt: { gte: dayCutoff } } }),
      db.developer.findUnique({ where: { id: run.developerId }, select: { companyName: true, active: true } }),
    ]);
    if (active || !developer?.active || recentFailures >= RESEARCH_MAX_ATTEMPTS) continue;
    const retry = await db.developerResearchRun.create({ data: { developerId: run.developerId, status: "QUEUED", researchVersion: DEVELOPER_RESEARCH_VERSION } });
    await db.auditLog.create({ data: { type: "research.developer_dossier", summary: `Queued bounded automatic retry for ${developer.companyName}.`, details: { priorRunId: run.id, runId: retry.id, retry: recentFailures + 1 } } });
    dossierRetries += 1;
  }

  return { requeued, exhausted, approvalReleased, dossierRetries };
}
