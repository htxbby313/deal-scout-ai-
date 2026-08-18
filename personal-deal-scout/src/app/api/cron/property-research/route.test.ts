import { afterEach, describe, expect, it } from "vitest";
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
});
