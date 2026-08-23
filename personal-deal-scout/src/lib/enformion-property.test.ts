import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnformionProperty, researchPropertyWithEnformion } from "@/lib/enformion-property";

const input = { address: "214 Glencrest Dr", city: "San Antonio", state: "TX", zipCode: "78201" };

describe("Enformion property research", () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.ENFORMION_ACCESS_PROFILE_NAME; delete process.env.ENFORMION_ACCESS_PROFILE_PASSWORD; });

  it("does not call the provider without both server credentials", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect(await researchPropertyWithEnformion(input)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a provider record for a different property", () => {
    const result = parseEnformionProperty(input, { PropertyV2Records: [{ Property: { Summary: { Address: { AddressLine1: "999 Other Rd", AddressLine2: "Austin, TX 78701", State: "TX", ZipCode: "78701" } } } }] });
    expect(result).toEqual({ matched: false, ownerNames: [] });
  });

  it("extracts only allowlisted property facts after an exact address match", () => {
    const result = parseEnformionProperty(input, { PropertyV2Records: [{ Property: { Summary: { Address: { AddressLine1: "214 GLENCREST DR", City: "San Antonio", State: "TX", ZipCode: "78201" }, CurrentOwners: [{ Name: { FullName: "Cole Owner", Ssn: "must-not-survive" } }] }, AssessorRecords: [{ Address: { AddressLine1: "214 Glencrest Drive", State: "TX", ZipCode: "78201" }, PropertyIdentification: { OnlineFormattedParcelId: "123-456", ZoningCode: "R5" }, PropertyLegal: { LegalDescription: "LOT 7 BLOCK 2" }, Tax: { AssessedTotalValue: "330000", TaxAmount: "6412.50", TaxYear: "2025" }, PropertySize: { Acres: "0.25", FrontFootage: "75" }, Utilities: { WaterCodeDescription: "Public water" } }] } }] });
    expect(result).toMatchObject({ matched: true, ownerNames: ["Cole Owner"], apn: "123-456", legalDescription: "LOT 7 BLOCK 2", assessedValue: 330000, taxAmount: 6412.5, zoning: "R5", dimensions: "0.25 acres · 75 ft frontage", utilities: "Public water" });
    expect(JSON.stringify(result)).not.toContain("must-not-survive");
  });
});
