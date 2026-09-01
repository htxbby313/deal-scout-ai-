import { describe, expect, it } from "vitest";
import { primaryDestinationFor, primaryNavigation } from "@/app/workspace-shell";

describe("workspace navigation", () => {
  it("has exactly five business-first primary destinations", () => {
    expect(primaryNavigation.map((item) => item.label)).toEqual(["Today", "Leads", "Deals", "Buyers", "Reports"]);
  });

  it("keeps legacy routes in the correct visible destination", () => {
    expect(primaryDestinationFor("properties")).toBe("Leads");
    expect(primaryDestinationFor("seller-crm")).toBe("Deals");
    expect(primaryDestinationFor("buyer-evidence")).toBe("Buyers");
    expect(primaryDestinationFor("profitability")).toBe("Reports");
  });
});
