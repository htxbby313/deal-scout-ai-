import { describe, expect, it } from "vitest";
import { __officialPropertySourceTestables } from "@/lib/official-property-sources";

const { addressSearch, bexarParcelFindings, sanAntonioAddressFindings, femaFloodFinding } = __officialPropertySourceTestables;

describe("official property source adapters", () => {
  it("builds a bounded address search from a normal street address", () => {
    expect(addressSearch("214 Glencrest Dr")).toBe("214%GLENCREST");
  });

  it("maps Bexar County parcel evidence without inventing frontage", () => {
    const findings = bexarParcelFindings({ Owner: "MORENO DORA F", PropID: 491517, AcctNumb: "11775-009-0090", LglDesc: "NCB 11775 BLK 9 LOT 9", LandVal: 60440, ImprVal: 182620, TotVal: 243060, Acres: 0.2336, YrBlt: "1955", PropUse: "1" }, "https://maps.bexar.org/query");
    expect(findings.map((finding) => finding.topic)).toEqual(["OWNERSHIP", "PARCEL", "TAX", "DIMENSIONS", "ZONING"]);
    expect(findings.find((finding) => finding.topic === "DIMENSIONS")?.value).toContain("frontage is not reported");
    expect(findings.find((finding) => finding.topic === "TAX")?.value).toContain("$243,060");
  });

  it("reports an empty historic indicator as a verified screening result", () => {
    const findings = sanAntonioAddressFindings({ NeighborhoodName: "Hillcrest", HistoricDistrict: null, HistoricLandmarkSites: null, Fire: "SAN ANTONIO FIRE", EMS: "SAN ANTONIO EMS", GarbageServices: "AUTOMATED" }, "https://sanantonio.gov/query");
    expect(findings.find((finding) => finding.topic === "HISTORIC")?.value).toContain("No historic district");
    expect(findings.find((finding) => finding.topic === "UTILITIES")?.value).toContain("Hillcrest");
  });

  it("converts FEMA zone attributes into a sourced flood screening", () => {
    const finding = femaFloodFinding({ FLD_ZONE: "X", ZONE_SUBTY: "AREA OF MINIMAL FLOOD HAZARD", SFHA_TF: "F" }, "https://hazards.fema.gov/query");
    expect(finding.value).toContain("special flood hazard area: no");
    expect(finding.status).toBe("VERIFIED");
  });
});
