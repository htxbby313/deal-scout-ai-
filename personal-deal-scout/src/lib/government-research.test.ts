import { describe, expect, it } from "vitest";
import { __governmentTestables } from "@/lib/government-research";

describe("government research", () => {
  it("parses Census county permit units and value", () => {
    const text = "header one\nheader two\n\n202606,01,003,3,6,Baldwin County,1698,1698,571941537,2,4,850212,1,3,502729,9,62,10560976";
    expect(__governmentTestables.parseCountyPermits(text)[0]).toMatchObject({ fips: "01003", countyName: "Baldwin County", stateName: "Alabama", units: 1767, value: 583855454n });
  });

  it("tries recent completed months instead of assuming publication", () => {
    expect(__governmentTestables.candidatePeriods(new Date("2026-08-15T00:00:00Z"))).toEqual(["202607", "202606", "202605", "202604"]);
  });
});
