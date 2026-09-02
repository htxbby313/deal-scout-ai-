import { describe, expect, it } from "vitest";
import { sortOwnerQueue } from "@/lib/funnel-owner-queue";

describe("funnel owner queue", () => {
  it("puts urgent work first and oldest work first within priority", () => {
    const items = sortOwnerQueue([
      { id: "new", kind: "FUNNEL_BLOCKER", label: "new", createdAt: new Date("2026-08-19"), urgent: false, href: "/pipeline" },
      { id: "urgent", kind: "TRANSACTION_APPROVAL", label: "urgent", createdAt: new Date("2026-08-19"), urgent: true, href: "/transactions" },
      { id: "old", kind: "SELLER_ENGAGEMENT", label: "old", createdAt: new Date("2026-08-01"), urgent: false, href: "/seller-crm" },
    ]);
    expect(items.map((item) => item.id)).toEqual(["urgent", "old", "new"]);
  });

  it("ranks non-urgent property work from most likely to transact to least", () => {
    const items = sortOwnerQueue([
      { id: "least", kind: "FUNNEL_BLOCKER", label: "least", createdAt: new Date("2026-08-01"), urgent: false, transactionLikelihoodScore: 15, href: "/pipeline" },
      { id: "most", kind: "SELLER_ENGAGEMENT", label: "most", createdAt: new Date("2026-08-19"), urgent: false, transactionLikelihoodScore: 88, href: "/seller-crm" },
      { id: "middle", kind: "AGENT_TASK", label: "middle", createdAt: new Date("2026-08-10"), urgent: false, transactionLikelihoodScore: 54, href: "/agents" },
    ]);
    expect(items.map((item) => item.id)).toEqual(["most", "middle", "least"]);
  });
});
