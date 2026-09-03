import { afterEach, describe, expect, it, vi } from "vitest";

const { scanActiveBuyBoxes } = vi.hoisted(() => ({
  scanActiveBuyBoxes: vi.fn(async () => ({
    scanned: 1,
    attachedCount: 2,
    results: [],
  })),
}));
vi.mock("@/lib/buy-box-service", () => ({ scanActiveBuyBoxes }));
import { GET } from "@/app/api/cron/buy-box-scan/route";

const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  vi.clearAllMocks();
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe("cached buy box scan cron", () => {
  it("fails closed when the cron secret is not configured", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(
      new Request("https://example.com/api/cron/buy-box-scan"),
    );
    expect(response.status).toBe(401);
    expect(scanActiveBuyBoxes).not.toHaveBeenCalled();
  });

  it("rejects an incorrect bearer token", async () => {
    process.env.CRON_SECRET = "configured-secret";
    const response = await GET(
      new Request("https://example.com/api/cron/buy-box-scan", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    expect(response.status).toBe(401);
    expect(scanActiveBuyBoxes).not.toHaveBeenCalled();
  });

  it("scans cached buy boxes without paid enrichment", async () => {
    process.env.CRON_SECRET = "configured-secret";
    const response = await GET(
      new Request("https://example.com/api/cron/buy-box-scan", {
        headers: { authorization: "Bearer configured-secret" },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      paidEnrichment: false,
      scanned: 1,
      attachedCount: 2,
    });
    expect(scanActiveBuyBoxes).toHaveBeenCalledOnce();
  });
});
