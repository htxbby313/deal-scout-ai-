import { handleCallback } from "@vercel/queue";
import { agentQueueMessageSchema } from "@/lib/agent-queue";
import { executeApprovedAgentTask, executeDealScoutOperations } from "@/lib/agent-operations";

export const maxDuration = 300;

export const POST = handleCallback(
  async (untrustedMessage) => {
    const message = agentQueueMessageSchema.parse(untrustedMessage);
    if (message.kind === "APPROVED_TASK") {
      await executeApprovedAgentTask(message.taskId);
      return;
    }
    await executeDealScoutOperations(message.trigger);
  },
  {
    visibilityTimeoutSeconds: 600,
    retry: (_error, metadata) => {
      if (metadata.deliveryCount >= 4) return { acknowledge: true };
      return { afterSeconds: Math.min(300, 15 * 2 ** metadata.deliveryCount) };
    },
  },
);
