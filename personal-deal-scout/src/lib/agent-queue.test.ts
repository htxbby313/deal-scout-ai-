import { beforeEach, describe, expect, it, vi } from "vitest";

const { send } = vi.hoisted(() => ({
  send: vi.fn(async () => ({ messageId: "message-1" })),
}));
vi.mock("@vercel/queue", () => ({ QueueClient: class { send = send; } }));

import {
  AGENT_OPERATIONS_TOPIC,
  agentQueueMessageSchema,
  enqueueAgentOperations,
  enqueueApprovedAgentTask,
} from "@/lib/agent-queue";

describe("agent operations queue", () => {
  beforeEach(() => send.mockClear());

  it("publishes a deduplicated daily cron cycle", async () => {
    await enqueueAgentOperations("CRON");
    expect(send).toHaveBeenCalledWith(
      AGENT_OPERATIONS_TOPIC,
      { kind: "OPERATIONS_CYCLE", trigger: "CRON" },
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^cron-\d{4}-\d{2}-\d{2}$/) }),
    );
  });

  it("publishes an approved task with a stable task key", async () => {
    await enqueueApprovedAgentTask("task-1");
    expect(send).toHaveBeenCalledWith(
      AGENT_OPERATIONS_TOPIC,
      { kind: "APPROVED_TASK", taskId: "task-1" },
      expect.objectContaining({ idempotencyKey: "approved-task-task-1" }),
    );
  });

  it("rejects untrusted queue messages", () => {
    expect(() => agentQueueMessageSchema.parse({ kind: "SEND_EMAIL", taskId: "task-1" })).toThrow();
  });
});
