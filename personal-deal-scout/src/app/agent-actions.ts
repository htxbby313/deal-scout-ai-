"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { reviewAgentTask, runAgentQueue } from "@/lib/agent-orchestration";

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

export async function reviewAgentTaskAction(taskId: string, decision: "APPROVE" | "REJECT", _state: AgentActionState, data: FormData): Promise<AgentActionState> {
  void _state;
  await requireOwner();
  try {
    await reviewAgentTask(taskId, decision === "APPROVE", String(data.get("note") ?? ""));
    revalidatePath("/agents");
    return { status: "success", message: decision === "APPROVE" ? "Task approved and returned to queue." : "Task rejected." };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Task review failed." }; }
}
