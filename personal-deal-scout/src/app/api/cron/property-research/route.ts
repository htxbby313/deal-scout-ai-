import { runAgentTeamBatch } from "@/lib/agent-orchestration";
import { runAutomaticResearchCycle } from "@/lib/automatic-research";
import { recoverAutomaticResearchWork } from "@/lib/research-automation";
import { synchronizeAcquisitionFunnels } from "@/lib/operating-layer";
import { synchronizeCountyCoverageTargets } from "@/lib/county-source-service";
import { runFunnelExpirationCycle } from "@/lib/funnel-automation";
import { runCountyAccessibilityChecks } from "@/lib/county-accessibility-service";
import { synchronizeCampaignCountyCoverage } from "@/lib/campaign-service";

export const maxDuration = 300;
const RESEARCH_BUDGET_MS = 240_000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const recovery = await recoverAutomaticResearchWork();
  const research = await runAutomaticResearchCycle({ deadlineAt: Date.now() + RESEARCH_BUDGET_MS });
  const [funnels, counties] = await Promise.all([
    synchronizeAcquisitionFunnels(),
    synchronizeCountyCoverageTargets(),
  ]);
  const [funnelExpirations, countyAccessibility, campaignCountyCoverage] = await Promise.all([
    runFunnelExpirationCycle(),
    runCountyAccessibilityChecks(10),
    synchronizeCampaignCountyCoverage(),
  ]);
  const agents = await runAgentTeamBatch();
  return Response.json({
    ok: true,
    recovery,
    research,
    funnels,
    funnelExpirations,
    counties,
    countyAccessibility,
    campaignCountyCoverage,
    agents,
  });
}
