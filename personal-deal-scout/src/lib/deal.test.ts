import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  property: { findUnique: vi.fn() },
  agentTask: { aggregate: vi.fn() },
  auditLog: { findMany: vi.fn() },
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
    db.agentTask.aggregate.mockResolvedValue({
      _sum: { estimatedCostCents: null },
    });
    db.auditLog.findMany.mockResolvedValue([]);
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
      priorityScore: null,
      gates: [],
      blockers: [],
      projection: null,
      outcome: null,
      unitCost: { agentTaskCostCents: BigInt(0), enformionReservations: 0 },
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
          outcomes: [],
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
          outcomes: [
            {
              id: "out-2",
              version: 2,
              status: "CLOSED_ASSIGNED",
              assignmentFee: 1_500_000,
              cycleDays: 21,
            },
          ],
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
            priorityScores: [
              {
                id: "pps-2",
                version: 2,
                totalScore: 72,
                reasons: ["evidence_ready", "buyer_coverage"],
                blockers: [],
              },
            ],
          },
        },
      ],
    });
    const deal = await getDeal("prop-2");
    expect(deal?.transaction?.id).toBe("tx-live");
    expect(deal?.funnel?.id).toBe("funnel-1");
    expect(deal?.priorityScore).toEqual({
      id: "pps-2",
      version: 2,
      totalScore: 72,
      reasons: ["evidence_ready", "buyer_coverage"],
      blockers: [],
    });
    expect(deal?.projection).toEqual({ id: "proj-9", version: 9 });
    expect(deal?.outcome).toEqual({
      id: "out-2",
      version: 2,
      status: "CLOSED_ASSIGNED",
      assignmentFee: 1_500_000,
      cycleDays: 21,
    });
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

  it("exposes a null priorityScore when the canonical funnel has no history", async () => {
    db.property.findUnique.mockResolvedValue({
      id: "prop-3",
      address: "10 Pine Street",
      researchFindings: [],
      comparableSales: [],
      discoveryReferences: [],
      media: [],
      acquisitionFunnels: [],
      matches: [],
      transactions: [
        {
          id: "tx-3",
          controlStatus: "ACTIVE",
          createdAt: created("2026-09-01T00:00:00Z"),
          financialProjections: [],
          sellerEngagements: [],
          outcomes: [],
          documents: [],
          approvals: [],
          acquisitionFunnel: {
            id: "funnel-3",
            gates: [],
            blockers: [],
            priorityScores: [],
          },
        },
      ],
    });
    const deal = await getDeal("prop-3");
    expect(deal?.funnel?.id).toBe("funnel-3");
    expect(deal?.priorityScore).toBeNull();
  });

  it("attaches unit cost from agent-task sum and bounded Enformion reservation rows", async () => {
    db.property.findUnique.mockResolvedValue({
      id: "prop-cost",
      researchFindings: [],
      comparableSales: [],
      discoveryReferences: [],
      media: [],
      acquisitionFunnels: [],
      matches: [],
      transactions: [],
    });
    db.agentTask.aggregate.mockResolvedValue({
      _sum: { estimatedCostCents: BigInt(450) },
    });
    db.auditLog.findMany.mockResolvedValue([
      { details: { propertyId: "prop-cost" } },
      { details: { propertyId: "other" } },
      { details: { propertyId: "prop-cost" } },
    ]);
    const deal = await getDeal("prop-cost");
    expect(deal?.unitCost).toEqual({
      agentTaskCostCents: BigInt(450),
      enformionReservations: 2,
    });
    expect(db.auditLog.findMany).toHaveBeenCalledWith({
      where: { type: "research.enformion_lookup_reserved" },
      select: { details: true },
      orderBy: { createdAt: "desc" },
      take: 5_000,
    });
    expect(db.agentTask.aggregate).toHaveBeenCalledWith({
      where: { propertyId: "prop-cost" },
      _sum: { estimatedCostCents: true },
    });
  });
});
