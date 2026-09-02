import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  firecrawlConfigured,
  firecrawlMaxRequestsPerRun,
  scrapePropertySourceWithFirecrawl,
} from "@/lib/firecrawl-property-research";
import { __researchRuntimeTestables } from "@/lib/research-runtime";

describe("Firecrawl property research", () => {
  beforeEach(() => {
    vi.stubEnv("FIRECRAWL_ENABLED", "true");
    vi.stubEnv("FIRECRAWL_API_KEY", "test-server-key");
    vi.stubEnv("FIRECRAWL_MAX_REQUESTS_PER_RUN", "2");
    __researchRuntimeTestables.resetCircuits();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("requires an explicit backend enable flag and key", () => {
    expect(firecrawlConfigured()).toBe(true);
    vi.stubEnv("FIRECRAWL_ENABLED", "false");
    expect(firecrawlConfigured()).toBe(false);
  });

  it("caps the configurable requests per property run", () => {
    vi.stubEnv("FIRECRAWL_MAX_REQUESTS_PER_RUN", "99");
    expect(firecrawlMaxRequestsPerRun()).toBe(6);
    vi.stubEnv("FIRECRAWL_MAX_REQUESTS_PER_RUN", "0");
    expect(firecrawlMaxRequestsPerRun()).toBe(0);
  });

  it("rejects private or insecure source URLs before making a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(
      scrapePropertySourceWithFirecrawl("http://127.0.0.1/property"),
    ).rejects.toThrow("safe public HTTPS URLs");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("scrapes a saved source page and preserves its receipt", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            markdown: "# 2147 Oakview Drive\nFictional Falls, TX 78123",
            images: [
              "https://images.example.com/home.jpg",
              "https://images.example.com/home.jpg",
              "http://127.0.0.1/private.jpg",
            ],
            links: ["https://example.com/details"],
            metadata: {
              title: "2147 Oakview Drive",
              sourceURL: "https://example.com/property/2147-oakview",
              scrapeId: "scrape-receipt-123",
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await scrapePropertySourceWithFirecrawl(
      "https://example.com/property/2147-oakview",
    );

    expect(result.receipt).toBe("scrape-receipt-123");
    expect(result.images).toEqual(["https://images.example.com/home.jpg"]);
    expect(result.sourceUrl).toBe(
      "https://example.com/property/2147-oakview",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, request] = fetchMock.mock.calls[0];
    expect(request?.method).toBe("POST");
    expect(new Headers(request?.headers).get("authorization")).toBe(
      "Bearer test-server-key",
    );
  });
});
