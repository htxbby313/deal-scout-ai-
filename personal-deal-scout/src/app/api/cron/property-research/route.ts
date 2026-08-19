import { runAgentTeamBatch } from "@/lib/agent-orchestration";
import { runAutomaticResearchCycle } from "@/lib/automatic-research";
import { recoverAutomaticResearchWork } from "@/lib/research-automation";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const recovery = await recoverAutomaticResearchWork();
  const research = await runAutomaticResearchCycle();
  const agents = await runAgentTeamBatch();
  return Response.json({ ok: true, recovery, research, agents });
}
