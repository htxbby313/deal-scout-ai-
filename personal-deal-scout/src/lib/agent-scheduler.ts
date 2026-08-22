import "server-only";

import type { AgentCycleTrigger } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

export async function beginAgentSchedulerCycle(trigger: AgentCycleTrigger) {
  return getPrisma().agentSchedulerCycle.create({ data: { trigger, deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null } });
}

export async function finishAgentSchedulerCycle(input: { cycleId: string; status: "COMPLETED" | "PARTIAL" | "FAILED"; startedAt: Date; researchSummary?: unknown; seed?: { properties: number; developers: number; transactions: number }; errors?: string[] }) {
  const db = getPrisma();
  const [created, statuses] = await Promise.all([
    db.agentTask.count({ where: { createdAt: { gte: input.startedAt } } }),
    db.agentTask.groupBy({ by: ["status"], where: { updatedAt: { gte: input.startedAt } }, _count: true }),
  ]);
  const count = (status: string) => statuses.find((item) => item.status === status)?._count ?? 0;
  return db.agentSchedulerCycle.update({ where: { id: input.cycleId }, data: { status: input.status, tasksCreated: created, tasksProcessed: statuses.reduce((sum, item) => sum + item._count, 0), tasksCompleted: count("COMPLETED"), tasksFailed: count("FAILED"), tasksWaitingApproval: count("WAITING_FOR_APPROVAL"), propertiesConsidered: input.seed?.properties ?? 0, developersConsidered: input.seed?.developers ?? 0, transactionsConsidered: input.seed?.transactions ?? 0, researchSummary: input.researchSummary as never, errors: input.errors?.length ? input.errors : undefined, finishedAt: new Date() } });
}

export async function readAgentSchedulerHealth(now = new Date()) {
  const latest = await getPrisma().agentSchedulerCycle.findFirst({ orderBy: { startedAt: "desc" } });
  return schedulerHealthFromLatest(latest, now);
}

export function schedulerHealthFromLatest(latest: { id: string; trigger: string; status: string; startedAt: Date; finishedAt: Date | null; tasksCreated: number; tasksProcessed: number; tasksCompleted: number; tasksFailed: number; tasksWaitingApproval: number } | null, now: Date) {
  const expectedDailyMs = 26 * 60 * 60_000;
  const healthy = Boolean(latest?.status === "COMPLETED" && latest.finishedAt && now.getTime() - latest.finishedAt.getTime() <= expectedDailyMs);
  return { healthy, latest: latest ? { ...latest, startedAt: latest.startedAt.toISOString(), finishedAt: latest.finishedAt?.toISOString() ?? null } : null, nextScheduledAt: nextDailyRun(now).toISOString() };
}

export function nextDailyRun(now: Date) {
  const next = new Date(now); next.setUTCHours(7, 0, 0, 0); if (next <= now) next.setUTCDate(next.getUTCDate() + 1); return next;
}
