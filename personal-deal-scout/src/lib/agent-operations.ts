import type { AgentCycleTrigger } from "@prisma/client";
import { beginAgentSchedulerCycle, finishAgentSchedulerCycle } from "@/lib/agent-scheduler";
import { runAgentTask, runAgentTeamBatch, seedAgentWork } from "@/lib/agent-orchestration";
import { runAutomaticResearchCycle } from "@/lib/automatic-research";
import { recoverAutomaticResearchWork } from "@/lib/research-automation";
import { synchronizeAcquisitionFunnels } from "@/lib/operating-layer";
import { synchronizeCountyCoverageTargets } from "@/lib/county-source-service";
import { runFunnelExpirationCycle } from "@/lib/funnel-automation";
import { runCountyAccessibilityChecks } from "@/lib/county-accessibility-service";
import { synchronizeCampaignCountyCoverage } from "@/lib/campaign-service";

export async function executeDealScoutOperations(trigger: AgentCycleTrigger) {
  const cycle = await beginAgentSchedulerCycle(trigger);
  try {
    const recovery = await recoverAutomaticResearchWork();
    const research = await runAutomaticResearchCycle();
    const [funnels, counties] = await Promise.all([
      synchronizeAcquisitionFunnels(),
      synchronizeCountyCoverageTargets(),
    ]);
    const [funnelExpirations, countyAccessibility, campaignCountyCoverage] = await Promise.all([
      runFunnelExpirationCycle(),
      runCountyAccessibilityChecks(10),
      synchronizeCampaignCountyCoverage(),
    ]);
    const seeded = await seedAgentWork();
    const agents = await runAgentTeamBatch();
    await finishAgentSchedulerCycle({
      cycleId: cycle.id,
      status: "COMPLETED",
      startedAt: cycle.startedAt,
      researchSummary: {
        recovery,
        research,
        funnels,
        counties,
        funnelExpirations,
        countyAccessibility,
        campaignCountyCoverage,
      },
      seed: seeded,
    });
    return { cycleId: cycle.id, agents };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent operations cycle failed.";
    await finishAgentSchedulerCycle({
      cycleId: cycle.id,
      status: "FAILED",
      startedAt: cycle.startedAt,
      errors: [message],
    });
    throw error;
  }
}

export async function executeApprovedAgentTask(taskId: string) {
  return runAgentTask(taskId);
}
