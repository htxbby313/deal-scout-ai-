import { describe, expect, it } from "vitest";
import { moreNavigation, primaryNavigation } from "@/lib/workspace-nav";

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

  it("keeps engine tools in More instead of equal-weight tabs", () => {
    expect(moreNavigation.map(([, label]) => label)).toEqual([
      "Agent activity",
      "Reports",
      "Profitability",
      "Settings",
    ]);
  });
});
