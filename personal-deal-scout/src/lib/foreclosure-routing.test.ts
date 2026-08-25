import { describe, expect, it } from "vitest";
import { routeForeclosure } from "./foreclosure-routing";

describe("foreclosure routing workflow", () => {
  it("holds an unverified foreclosure record instead of marking it ready to contact", () => {
    const decision = routeForeclosure({ ownerName: "Unknown Owner" });
    expect(decision.route).toBe("VERIFY_STATUS");
    expect(decision.status).toBe("NEEDS_VERIFICATION");
    expect(decision.canContactOwner).toBe(false);
  });

  it("routes a verified positive-equity pre-foreclosure to owner outreach", () => {
    const decision = routeForeclosure({
      preforeclosure: true,
      ownerName: "Jane Homeowner",
      sourceUrl: "https://example.gov/record/1",
      estimatedValue: 220000,
      estimatedDebt: 150000,
      liensAndTaxes: 10000,
    });
    expect(decision.route).toBe("OWNER_OUTREACH");
    expect(decision.estimatedEquity).toBe(60000);
    expect(decision.status).toBe("READY_FOR_DILIGENCE");
    expect(decision.canContactOwner).toBe(true);
  });

  it("routes HUD ownership to formal bid diligence and never owner outreach", () => {
    const decision = routeForeclosure({
      ownerName: "U.S. Department of Housing and Urban Development",
      sourceName: "HUD FHA Single Family REO",
      sourceUrl: "https://egis.hud.gov/record/42",
    });
    expect(decision.stage).toBe("HUD_OWNED");
    expect(decision.route).toBe("HUD_BROKER_BID");
    expect(decision.canContactOwner).toBe(false);
  });

  it("keeps a pre-foreclosure with unknown equity in verification", () => {
    const decision = routeForeclosure({
      preforeclosure: true,
      ownerName: "Jane Homeowner",
      sourceUrl: "https://example.gov/record/2",
    });
    expect(decision.status).toBe("NEEDS_VERIFICATION");
    expect(decision.blockers).toContain("Equity is unverified");
  });
});
