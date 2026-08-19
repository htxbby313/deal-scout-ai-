import { runAutomaticPropertyResearchBatch } from "@/lib/property-research";
import { runAutomaticDeveloperResearchBatch } from "@/lib/developer-research";
import { runAgentTeamBatch } from "@/lib/agent-orchestration";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const [properties, developers, agents] = await Promise.all([runAutomaticPropertyResearchBatch(2), runAutomaticDeveloperResearchBatch(5), runAgentTeamBatch()]);
  return Response.json({ ok: true, properties, developers, agents });
}
