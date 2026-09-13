import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseEnformionProperty,
  researchPropertyWithEnformion,
} from "@/lib/enformion-property";

const input = {
  address: "214 Glencrest Dr",
  city: "San Antonio",
  state: "TX",
  zipCode: "78201",
};

describe("Enformion property research", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ENFORMION_ACCESS_PROFILE_NAME;
    delete process.env.ENFORMION_ACCESS_PROFILE_PASSWORD;
  });

  it("does not call the provider without both server credentials", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await researchPropertyWithEnformion(input)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a provider record for a different property", () => {
    const result = parseEnformionProperty(input, {
      PropertyV2Records: [
        {
          Property: {
            Summary: {
              Address: {
                AddressLine1: "999 Other Rd",
                AddressLine2: "Austin, TX 78701",
                State: "TX",
                ZipCode: "78701",
              },
            },
          },
        },
      ],
    });
    expect(result).toEqual({ matched: false, ownerNames: [] });
  });

  it("extracts the full property intelligence allowlist after an exact address match", () => {
    const result = parseEnformionProperty(input, {
      PropertyV2Records: [
        {
          Property: {
            Summary: {
              Address: {
                AddressLine1: "214 GLENCREST DR",
                City: "San Antonio",
                State: "TX",
                ZipCode: "78201",
              },
              CurrentOwners: [
                {
                  IsCorporationOrBusiness: true,
                  Name: {
                    CompanyName: "Cole Holdings LLC",
                    Ssn: "must-not-survive",
                  },
                },
              ],
            },
            AssessorRecords: [
              {
                Address: {
                  AddressLine1: "214 Glencrest Drive",
                  State: "TX",
                  ZipCode: "78201",
                },
                PropertyIdentification: {
                  OnlineFormattedParcelId: "123-456",
                  AlternateParcelId: "ALT-99",
                  ZoningCode: "R5",
                  CountyUseDescr: "Single Family Residence",
                },
                PropertyLegal: { LegalDescription: "LOT 7 BLOCK 2" },
                OwnerMailingAddress: [
                  {
                    AddressLine1: "PO BOX 1562",
                    AddressLine2: "SAN ANTONIO, TX 78201",
                  },
                ],
                Tax: {
                  AssessedTotalValue: "330000",
                  AssessedLandValue: "90000",
                  AssessedImprovementValue: "240000",
                  MarketTotalValue: "355000",
                  TaxAmount: "6412.50",
                  TaxYear: "2025",
                  AssessedYear: "2025",
                },
                PropertySize: {
                  Acres: "0.25",
                  LandSquareFootage: "10890",
                  FrontFootage: "75",
                  DepthFootage: "145",
                  BuildingSquareFootage: "1820",
                },
                Structure: {
                  YearBuilt: "1987",
                  Bedrooms: "3",
                  TotalBathrooms: "2",
                  ConstructionTypeCodeDescription: "Brick",
                  GarageCode: "001",
                  NumberOfParkingSpaces: "2",
                  PoolIndicator: "N",
                  NumberOfUnits: "1",
                },
                Utilities: { WaterCodeDescription: "Public water" },
              },
            ],
          },
        },
      ],
    });

    expect(result).toMatchObject({
      matched: true,
      ownerNames: ["Cole Holdings LLC"],
      ownerType: "Business / organization",
      mailingAddress: "PO BOX 1562, SAN ANTONIO, TX 78201",
      apn: "123-456",
      alternateParcelId: "ALT-99",
      legalDescription: "LOT 7 BLOCK 2",
      landUse: "Single Family Residence",
      assessedValue: 330000,
      assessedLandValue: 90000,
      assessedImprovementValue: 240000,
      marketValue: 355000,
      taxAmount: 6412.5,
      taxYear: "2025",
      assessedYear: "2025",
      zoning: "R5",
      dimensions: "10,890 sq ft · 0.25 acres · 75 ft frontage · 145 ft depth",
      landSquareFeet: 10890,
      acres: 0.25,
      frontageFeet: 75,
      depthFeet: 145,
      buildingSquareFeet: 1820,
      yearBuilt: "1987",
      bedrooms: 3,
      bathrooms: 2,
      constructionType: "Brick",
      garage: "Yes",
      parkingSpaces: 2,
      pool: "No",
      numberOfUnits: 1,
      utilities: "Public water",
    });
    expect(JSON.stringify(result)).not.toContain("must-not-survive");
  });
});
