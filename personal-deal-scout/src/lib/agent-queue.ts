import { randomUUID } from "node:crypto";
import type { AgentCycleTrigger } from "@prisma/client";
import { send } from "@vercel/queue";
import { z } from "zod";

export const AGENT_OPERATIONS_TOPIC = "deal-scout-agent-operations";

export const agentQueueMessageSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("OPERATIONS_CYCLE"),
    trigger: z.enum(["CRON", "OWNER", "EVENT", "RECOVERY"]),
  }),
  z.object({
    kind: z.literal("APPROVED_TASK"),
    taskId: z.string().min(1),
  }),
]);

export type AgentQueueMessage = z.infer<typeof agentQueueMessageSchema>;

function cycleKey(trigger: AgentCycleTrigger) {
  if (trigger === "CRON") return `cron-${new Date().toISOString().slice(0, 10)}`;
  return `${trigger.toLowerCase()}-${randomUUID()}`;
}

export async function enqueueAgentOperations(trigger: AgentCycleTrigger) {
  return send(
    AGENT_OPERATIONS_TOPIC,
    { kind: "OPERATIONS_CYCLE", trigger } satisfies AgentQueueMessage,
    { idempotencyKey: cycleKey(trigger), retentionSeconds: 86_400 },
  );
}

export async function enqueueApprovedAgentTask(taskId: string) {
  return send(
    AGENT_OPERATIONS_TOPIC,
    { kind: "APPROVED_TASK", taskId } satisfies AgentQueueMessage,
    { idempotencyKey: `approved-task-${taskId}`, retentionSeconds: 86_400 },
  );
}
