import { describe, expect, it } from "vitest";
import { buildLandDealWatchBrief } from "@/lib/land-deal-watch";

const base = { address: "10 Main St", ownerName: "Pat", findings: [], closedCompCount: 0, buyerNames: [], conversationSummaries: [] };
describe("Land Deal Watch workflow", () => {
  it("withholds value and spread when closed-sale support is insufficient", () => {
    const result = buildLandDealWatchBrief(base);
    expect(result.value).toContain("not supportable");
    expect(result.acquisitionRange.ceiling).toBeNull();
    expect(result.spread).toContain("withheld");
  });
  it("never treats a closed comp price as an acquisition ceiling", () => {
    const result = buildLandDealWatchBrief({
      ...base,
      closedCompCount: 3,
      closedCompValueLowCents: BigInt(100_000_00),
      closedCompValueBaseCents: BigInt(120_000_00),
      closedCompValueHighCents: BigInt(140_000_00),
      projectedSpreadCents: BigInt(15_000_00),
    });
    expect(result.value).toContain("supportable from closed sales");
    expect(result.acquisitionRange.ceiling).toBeNull();
    expect(result.spread).toContain("withheld");
  });
  it("surfaces conflicts and requests their resolution", () => {
    const result = buildLandDealWatchBrief({ ...base, findings: [{ topic: "PARCEL", label: "Acreage", value: "1.4 acres vs 0.85 acres", status: "CONFLICT" }] });
    expect(result.status).toBe("NEEDS ONE VERIFICATION");
    expect(result.conflicts[0]).toContain("1.4 acres vs 0.85 acres");
    expect(result.nextAction).toContain("Resolve");
  });
  it("regenerates to a materially different evidence-backed angle", () => {
    const input = { ...base, findings: [{ topic: "LISTING", label: "Listing", value: "120 DOM and price reduced", status: "VERIFIED" as const }], buyerNames: ["Builder One"] };
    const first = buildLandDealWatchBrief(input, 0);
    const second = buildLandDealWatchBrief(input, 1);
    expect(second.angle).not.toBe(first.angle);
    expect(second.outreach.call).not.toBe(first.outreach.call);
    expect(second.whyThisMessage).toContain(second.angle);
    expect(second.angle).toContain("potential");
  });
  it("uses new call notes in status and motivation reasoning", () => {
    const result = buildLandDealWatchBrief({ ...base, conversationSummaries: ["Seller wants an as-is quick closing"] });
    expect(result.status).toBe("NEGOTIATE");
    expect(result.motivation).toContain("Seller conversation evidence recorded");
  });
});
