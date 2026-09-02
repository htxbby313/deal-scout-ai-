import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ media: vi.fn(), mediaFindMany: vi.fn().mockResolvedValue([]), mediaDeleteMany: vi.fn(), finding: vi.fn(), html: "" }));
vi.mock("@/lib/prisma", () => ({ getPrisma: () => {
  const tx = {
    propertyMedia: { upsert: mocks.media, findMany: mocks.mediaFindMany, deleteMany: mocks.mediaDeleteMany },
    propertyResearchFinding: { upsert: mocks.finding },
    propertyResearchRun: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    ...tx,
    property: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "property-1", address: "1200 Main Street", city: "Jackson", state: "MS", zipCode: "39201", sourceUrl: "https://listing.example.com/1200-main", discoveryReferences: [] }) },
    propertyResearchFinding: { findMany: vi.fn().mockResolvedValue([]) },
    propertyResearchRun: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "run-1" }) },
    $transaction: (operation: (client: typeof tx) => unknown) => operation(tx),
  };
} }));
vi.mock("@/lib/enformion-property", () => ({ enformionConfigured: () => false }));
vi.mock("@/lib/research-runtime", async (load) => ({
  ...await load<typeof import("@/lib/research-runtime")>(),
  fetchWithRetry: vi.fn().mockImplementation(async () => new Response(mocks.html, { headers: { "content-type": "text/html" } })),
  fetchValidatedJson: vi.fn().mockRejectedValue(new Error("No geocode in fixture")),
}));
import { researchProperty } from "@/lib/property-research";

beforeEach(() => { vi.clearAllMocks(); });
describe("automatic property photo ingestion", () => {
  it("persists matched source photos without asking the owner or granting sharing rights", async () => {
    mocks.html = '<title>1200 Main Street, Jackson MS 39201</title><img alt="1200 Main Street" src="/placeholder.gif" data-src="/front.jpg">';
    await researchProperty("property-1");
    expect(mocks.media).toHaveBeenCalledOnce();
    expect(mocks.media.mock.calls[0][0].create).toMatchObject({ propertyId: "property-1", url: "https://listing.example.com/front.jpg", sourceUrl: "https://listing.example.com/1200-main" });
    expect(mocks.media.mock.calls[0][0].create.sendApproved).toBeUndefined();
    expect(mocks.media.mock.calls[0][0].update.sendApproved).toBeUndefined();
    expect(mocks.finding.mock.calls.find(([input]) => input.create.topic === "PHOTOS")?.[0].create.sourceUrl).toBe("https://listing.example.com/1200-main");
  });
  it("does not attach a different property's image just to fill the card", async () => {
    mocks.html = '<title>900 Ocean Drive, Miami FL 33101</title><meta property="og:image" content="/wrong-house.jpg">';
    await researchProperty("property-1");
    expect(mocks.media).not.toHaveBeenCalled();
  });
});
