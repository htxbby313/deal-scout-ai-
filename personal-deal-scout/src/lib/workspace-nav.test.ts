import { describe, expect, it } from "vitest";
import { contextualGroupFor, contextualNavigation, moreNavigation, primaryNavigation } from "@/lib/workspace-nav";

describe("workspace navigation", () => {
  it("uses wholesaler cockpit labels on primary nav", () => {
    expect(primaryNavigation.map((item) => item.label)).toEqual([
      "Command Center",
      "Deals",
      "People",
      "Communications",
      "Transactions",
    ]);
  });

  it("maps sections to typed contextual groups and identifies title companies", () => {
    expect(contextualGroupFor("title-companies")).toBe("transactions");
    expect(contextualNavigation.transactions.find((item) => item.href === "/title-companies")?.active).toContain("title-companies");
    expect(contextualGroupFor("owner-queue")).toBeNull();
  });

  it("keeps engine tools in More instead of equal-weight tabs", () => {
    expect(moreNavigation.map(([, label]) => label)).toEqual([
      "Agent activity",
      "Reports",
      "Profitability",
      "Settings",
    ]);
  });
});
