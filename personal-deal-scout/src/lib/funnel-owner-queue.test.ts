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
});
