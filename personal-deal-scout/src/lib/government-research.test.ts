import { describe, expect, it } from "vitest";
import { __governmentTestables } from "@/lib/government-research";

describe("government research", () => {
  it("parses Census county permit units and value", () => {
    const text = "Survey Date\nCounty Building Permits\nmetadata\n202606,01,003,3,6,\"Baldwin \"\"Growth\"\" County\",1698,1698,571941537,2,4,850212,1,3,502729,9,62,10560976";
    expect(__governmentTestables.parseCountyPermits(text, "202606")[0]).toMatchObject({ period: "202606", fips: "01003", countyName: 'Baldwin "Growth" County', stateName: "Alabama", units: 1767, value: BigInt("583855454") });
  });

  it("rejects an unrecognized or mismatched file instead of persisting it", () => {
    expect(() => __governmentTestables.parseCountyPermits("not a census file")).toThrow("header was not recognized");
    const text = "Survey Date\nCounty Building Permits\nmetadata\n202605,01,003,3,6,Baldwin County,1,10,100,0,0,0,0,0,0,0,0,0";
    expect(() => __governmentTestables.parseCountyPermits(text, "202606")).toThrow("reported 202605, not 202606");
  });

  it("keeps a missing prior-year baseline unknown", () => {
    const current = __governmentTestables.parseCountyPermits("Survey Date\nCounty Building Permits\nmetadata\n202606,01,003,3,6,Baldwin County,1,10,100,0,0,0,0,0,0,0,0,0", "202606");
    expect(__governmentTestables.rankCountyPermits(current, [])[0]).toMatchObject({ priorUnits: null, growthPct: null, momentum: 10 });
  });

  it("tries recent completed months instead of assuming publication", () => {
    expect(__governmentTestables.candidatePeriods(new Date("2026-08-15T00:00:00Z"))).toEqual(["202607", "202606", "202605", "202604"]);
  });
});
