import { afterEach, describe, expect, it, vi } from "vitest";
const { enqueueAgentOperations } = vi.hoisted(() => ({
  enqueueAgentOperations: vi.fn(async () => ({ messageId: "queue-message-1" })),
}));
vi.mock("@/lib/agent-queue", () => ({ enqueueAgentOperations }));
import { GET } from "@/app/api/cron/property-research/route";

const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe("automatic property research cron", () => {
  it("fails closed when the cron secret is not configured", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new Request("https://example.com/api/cron/property-research"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("rejects an incorrect bearer token", async () => {
    process.env.CRON_SECRET = "configured-secret";
    const response = await GET(new Request("https://example.com/api/cron/property-research", { headers: { authorization: "Bearer wrong-secret" } }));
    expect(response.status).toBe(401);
  });

  it("queues the durable operations cycle and returns without waiting", async () => {
    process.env.CRON_SECRET = "configured-secret";
    const response = await GET(new Request("https://example.com/api/cron/property-research", { headers: { authorization: "Bearer configured-secret" } }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ ok: true, queueMessageId: "queue-message-1", status: "queued" });
    expect(enqueueAgentOperations).toHaveBeenCalledWith("CRON");
  });
});
