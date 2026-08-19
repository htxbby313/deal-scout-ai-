import { AgentDashboard } from "@/app/agents/agent-dashboard";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import { readAgentDashboard } from "@/lib/agent-orchestration";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  await requireOwner();
  const dashboard = await readAgentDashboard();
  return <WorkspaceShell active="agents"><div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8"><header className="border-b pb-6"><p className="text-sm font-semibold text-blue-700">Supervised operations</p><h1 className="mt-1 text-3xl font-bold">Agent Team</h1><p className="mt-2 text-sm text-slate-600">Five persisted roles prepare internal work, evidence, and handoffs. Autonomy stays locked until every legal and ethical gate is proven.</p></header><div className="mt-6"><AgentDashboard {...dashboard} /></div></div></WorkspaceShell>;
}
