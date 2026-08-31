import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ownerIsAuthenticated: vi.fn(async () => true),
  readiness: vi.fn(() => ({ allowed: true, blockers: [] as string[] })),
  findUnique: vi.fn(async () => ({
    address: "100 Main St",
    city: "Houston",
    state: "TX",
    zipCode: "77002",
  })),
}));

vi.mock("@/lib/auth", () => ({ ownerIsAuthenticated: mocks.ownerIsAuthenticated }));
vi.mock("@/lib/google-visual-context", () => ({
  evaluateGoogleVisualContextEnvironment: mocks.readiness,
}));
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({ property: { findUnique: mocks.findUnique } }),
}));

import { GET } from "@/app/api/property-card-image/route";

const originalServerKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  mocks.ownerIsAuthenticated.mockResolvedValue(true);
  mocks.readiness.mockReturnValue({ allowed: true, blockers: [] });
  if (originalServerKey === undefined) delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
  else process.env.GOOGLE_MAPS_SERVER_API_KEY = originalServerKey;
});

describe("owner-only property card imagery", () => {
  it("rejects unauthenticated image requests before database or provider access", async () => {
    mocks.ownerIsAuthenticated.mockResolvedValueOnce(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await GET(new Request("https://example.com/api/property-card-image?propertyId=p1"));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails closed when the Maps activation policy is not ready", async () => {
    mocks.readiness.mockReturnValueOnce({ allowed: false, blockers: ["server_key_missing"] });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await GET(new Request("https://example.com/api/property-card-image?propertyId=p1"));

    expect(response.status).toBe(503);
    expect(mocks.readiness).toHaveBeenCalledWith({ serverFeaturesRequired: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses the server key and returns verified imagery with private caching", async () => {
    process.env.GOOGLE_MAPS_SERVER_API_KEY = "server-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "OK" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }));

    const response = await GET(new Request("https://example.com/api/property-card-image?propertyId=p1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=86400");
    expect(response.headers.get("x-deal-scout-image-verification")).toBe("google-street-view-metadata-ok");
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("key=server-key");
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store" });
  });
});
