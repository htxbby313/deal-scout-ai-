import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseRentCastProperty,
  researchPropertyWithRentCast,
} from "@/lib/rentcast-property";

const input = {
  address: "5500 Grand Lake Dr",
  city: "San Antonio",
  state: "TX",
  zipCode: "78244",
};

describe("RentCast property research", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RENTCAST_API_KEY;
    delete process.env.RENTCAST_KEY;
  });

  it("does not call RentCast when no API key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await researchPropertyWithRentCast(input)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes owner, tax, parcel and feature fields", () => {
    const result = parseRentCastProperty(input, [
      {
        id: "5500-Grand-Lake-Dr,-San-Antonio,-TX-78244",
        formattedAddress: "5500 Grand Lake Dr, San Antonio, TX 78244",
        addressLine1: "5500 Grand Lake Dr",
        city: "San Antonio",
        state: "TX",
        zipCode: "78244",
        county: "Bexar",
        propertyType: "Single Family",
        bedrooms: 3,
        bathrooms: 2,
        squareFootage: 1878,
        lotSize: 8850,
        yearBuilt: 1973,
        assessorID: "05076-103-0500",
        legalDescription: "CB 5076A BLK 3 LOT 50",
        subdivision: "WOODLAKE",
        zoning: "RH",
        lastSaleDate: "2024-11-18T00:00:00.000Z",
        lastSalePrice: 270000,
        features: {
          architectureType: "Contemporary",
          exteriorType: "Brick",
          garage: true,
          garageSpaces: 2,
          garageType: "Garage",
          pool: false,
          unitCount: 1,
        },
        taxAssessments: {
          "2024": {
            year: 2024,
            value: 216513,
            land: 59380,
            improvements: 157133,
          },
        },
        propertyTaxes: {
          "2024": { year: 2024, total: 4065 },
        },
        owner: {
          names: ["Rolando Villarreal"],
          type: "Individual",
          mailingAddress: {
            formattedAddress: "PO Box 123, San Antonio, TX 78244",
          },
        },
        ownerOccupied: true,
      },
    ]);

    expect(result).toMatchObject({
      matched: true,
      ownerNames: ["Rolando Villarreal"],
      ownerType: "Individual",
      ownerOccupied: "Yes",
      mailingAddress: "PO Box 123, San Antonio, TX 78244",
      apn: "05076-103-0500",
      legalDescription: "CB 5076A BLK 3 LOT 50",
      landUse: "Single Family",
      assessedValue: 216513,
      assessedLandValue: 59380,
      assessedImprovementValue: 157133,
      taxAmount: 4065,
      taxYear: "2024",
      assessedYear: "2024",
      zoning: "RH",
      landSquareFeet: 8850,
      buildingSquareFeet: 1878,
      yearBuilt: "1973",
      bedrooms: 3,
      bathrooms: 2,
      constructionType: "Contemporary · Brick",
      garage: "Yes · Garage",
      parkingSpaces: 2,
      pool: "No",
      numberOfUnits: 1,
      county: "Bexar",
      propertyType: "Single Family",
      subdivision: "WOODLAKE",
      lastSalePrice: 270000,
    });
  });
});
