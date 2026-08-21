"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { reviewAgentTask, runAgentQueue, updateAgentAutonomy, updateAgentStatus } from "@/lib/agent-orchestration";

export type AgentActionState = { status: "idle" | "success" | "error"; message: string };

export async function runAgentQueueAction(agentId: string, _state: AgentActionState): Promise<AgentActionState> {
  void _state;
  await requireOwner();
  try {
    const result = await runAgentQueue(agentId, 5);
    revalidatePath("/agents"); revalidatePath("/operations"); revalidatePath("/transactions");
    return { status: "success", message: `${result.processed} task${result.processed === 1 ? "" : "s"} processed.` };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Agent queue failed." }; }
}

export async function updateAgentStatusAction(agentId: string, status: "ACTIVE" | "PAUSED" | "DISABLED", _state: AgentActionState): Promise<AgentActionState> {
  void _state;
  await requireOwner();
  try {
    await updateAgentStatus(agentId, status);
    revalidatePath("/agents"); revalidatePath("/owner-queue");
    return { status: "success", message: status === "ACTIVE" ? "Agent resumed." : status === "PAUSED" ? "Agent paused." : "Agent disabled." };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Agent status could not be changed." }; }
}

export async function updateAgentAutonomyAction(agentId: string, mode: "LOCKED" | "SUPERVISED" | "APPROVED_AUTONOMOUS", _state: AgentActionState): Promise<AgentActionState> {
  void _state;
  await requireOwner();
  try {
    await updateAgentAutonomy(agentId, mode);
    revalidatePath("/agents"); revalidatePath("/owner-queue");
    return { status: "success", message: `${mode.toLowerCase().replaceAll("_", " ")} mode saved. Outbound remains disabled.` };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Agent autonomy could not be changed." }; }
}

export async function reviewAgentTaskAction(taskId: string, decision: "APPROVE" | "REJECT", _state: AgentActionState, data: FormData): Promise<AgentActionState> {
  void _state;
  await requireOwner();
  try {
    await reviewAgentTask(taskId, decision === "APPROVE", String(data.get("note") ?? ""));
    revalidatePath("/agents");
    return { status: "success", message: decision === "APPROVE" ? "Task approved and returned to queue." : "Task rejected." };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Task review failed." }; }
}
