import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  property: { findUnique: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ getPrisma: () => db }));

import {
  ACTIVE_DEAL_TRANSACTION_EXISTS_MESSAGE,
  assertCanCreateDealTransaction,
  getDeal,
  selectCanonicalTransaction,
} from "@/lib/deal";

const created = (iso: string) => new Date(iso);

describe("canonical DealTransaction selection", () => {
  it("prefers the newest non-STOPPED transaction over a newer STOPPED row", () => {
    const canonical = selectCanonicalTransaction([
      {
        id: "stopped-newer",
        controlStatus: "STOPPED" as const,
        createdAt: created("2026-09-02T12:00:00Z"),
      },
      {
        id: "active-older",
        controlStatus: "ON_HOLD" as const,
        createdAt: created("2026-09-01T12:00:00Z"),
      },
    ]);
    expect(canonical?.id).toBe("active-older");
  });

  it("falls back to the newest STOPPED transaction when all are stopped", () => {
    const canonical = selectCanonicalTransaction([
      {
        id: "old-stop",
        controlStatus: "STOPPED" as const,
        createdAt: created("2026-08-01T00:00:00Z"),
      },
      {
        id: "new-stop",
        controlStatus: "STOPPED" as const,
        createdAt: created("2026-08-15T00:00:00Z"),
      },
    ]);
    expect(canonical?.id).toBe("new-stop");
  });

  it("returns null when the property has no transactions", () => {
    expect(selectCanonicalTransaction([])).toBeNull();
  });
});

describe("one-active-transaction guard", () => {
  it("refuses a second DealTransaction while a non-stopped, non-terminal row exists", () => {
    expect(() =>
      assertCanCreateDealTransaction([
        { controlStatus: "ON_HOLD", status: "DRAFT" },
      ]),
    ).toThrow(ACTIVE_DEAL_TRANSACTION_EXISTS_MESSAGE);
    expect(() =>
      assertCanCreateDealTransaction([
        { controlStatus: "ACTIVE", status: "UNDER_CONTRACT" },
      ]),
    ).toThrow(ACTIVE_DEAL_TRANSACTION_EXISTS_MESSAGE);
  });

  it("allows a new transaction after STOPPED or terminal statuses", () => {
    expect(() =>
      assertCanCreateDealTransaction([
        { controlStatus: "STOPPED", status: "CANCELLED" },
      ]),
    ).not.toThrow();
    expect(() =>
      assertCanCreateDealTransaction([
        { controlStatus: "ACTIVE", status: "COMPLETED" },
      ]),
    ).not.toThrow();
    expect(() =>
      assertCanCreateDealTransaction([
        { controlStatus: "ON_HOLD", status: "CANCELLED" },
      ]),
    ).not.toThrow();
    expect(() => assertCanCreateDealTransaction([])).not.toThrow();
  });
});

describe("getDeal aggregate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a property-shaped Deal with a null transaction when none exist", async () => {
    db.property.findUnique.mockResolvedValue({
      id: "prop-1",
      address: "1200 Main Street",
      researchFindings: [],
      comparableSales: [],
      discoveryReferences: [],
      media: [],
      acquisitionFunnels: [],
      matches: [],
      transactions: [],
    });
    const deal = await getDeal("prop-1");
    expect(deal).toMatchObject({
      property: { id: "prop-1", address: "1200 Main Street" },
      transaction: null,
      funnel: null,
      gates: [],
      blockers: [],
      projection: null,
      comps: [],
      matches: [],
      researchFindings: [],
      discoveryReferences: [],
      sellerEngagements: [],
      media: [],
    });
    expect(deal && "transactions" in deal.property).toBe(false);
  });

  it("attaches the canonical transaction, latest gates, projection, and seller engagements", async () => {
    db.property.findUnique.mockResolvedValue({
      id: "prop-2",
      address: "900 Ocean Drive",
      researchFindings: [{ id: "f1", status: "VERIFIED" }],
      comparableSales: [{ id: "c1" }],
      discoveryReferences: [{ id: "d1" }],
      media: [{ id: "m1" }],
      acquisitionFunnels: [{ id: "funnel-prop", stage: "DISCOVERED" }],
      matches: [{ id: "match-1", developer: { id: "dev-1" } }],
      transactions: [
        {
          id: "tx-stopped",
          controlStatus: "STOPPED",
          createdAt: created("2026-09-02T00:00:00Z"),
          financialProjections: [],
          sellerEngagements: [],
          acquisitionFunnel: null,
          documents: [],
          approvals: [],
        },
        {
          id: "tx-live",
          controlStatus: "ACTIVE",
          createdAt: created("2026-08-01T00:00:00Z"),
          financialProjections: [{ id: "proj-9", version: 9 }],
          sellerEngagements: [{ id: "eng-1" }],
          documents: [],
          approvals: [],
          acquisitionFunnel: {
            id: "funnel-1",
            gates: [
              { type: "PROPERTY_EVIDENCE", version: 1, status: "PENDING" },
              { type: "PROPERTY_EVIDENCE", version: 2, status: "SATISFIED" },
              { type: "BUYER_COVERAGE", version: 1, status: "SATISFIED" },
            ],
            blockers: [{ id: "b1", status: "OPEN" }],
          },
        },
      ],
    });
    const deal = await getDeal("prop-2");
    expect(deal?.transaction?.id).toBe("tx-live");
    expect(deal?.funnel?.id).toBe("funnel-1");
    expect(deal?.projection).toEqual({ id: "proj-9", version: 9 });
    expect(deal?.sellerEngagements).toEqual([{ id: "eng-1" }]);
    expect(deal?.blockers).toEqual([{ id: "b1", status: "OPEN" }]);
    expect(deal?.gates.map((gate) => `${gate.type}:${gate.version}`)).toEqual([
      "BUYER_COVERAGE:1",
      "PROPERTY_EVIDENCE:2",
    ]);
    expect(deal?.comps).toEqual([{ id: "c1" }]);
    expect(deal?.matches).toHaveLength(1);
    expect(deal?.researchFindings).toHaveLength(1);
    expect(deal?.discoveryReferences).toHaveLength(1);
  });

  it("returns null when the property does not exist", async () => {
    db.property.findUnique.mockResolvedValue(null);
    await expect(getDeal("missing")).resolves.toBeNull();
  });
});
