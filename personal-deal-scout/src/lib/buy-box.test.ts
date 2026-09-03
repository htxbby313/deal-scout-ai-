import { describe, expect, it } from "vitest";
import {
  parseBuyBoxPrompt,
  propertyMatchesBuyBox,
  selectBuyBoxMatches,
} from "./buy-box";

const meridian = {
  id: "p1",
  address: "214 Oak St",
  city: "Meridian",
  state: "ID",
  zipCode: "83642",
  county: "Ada",
  propertyType: "SFR",
  estimatedValue: 185_000,
};

describe("operator buy boxes", () => {
  it("parses a wholesaler prompt into structured criteria", () => {
    const box = parseBuyBoxPrompt(
      "Find 3/2 houses in Meridian under $200,000 with strong equity and at least $25,000 potential wholesale spread.",
    );
    expect(box.cities).toEqual(["Meridian"]);
    expect(box.propertyTypes).toEqual(["SFR"]);
    expect(box.maxPriceCents).toBe(BigInt(20_000_000));
    expect(box.minSpreadCents).toBe(BigInt(2_500_000));
  });

  it("matches cached properties on geo, type, and price without paid enrichment", () => {
    expect(
      propertyMatchesBuyBox(meridian, {
        name: "Meridian SFR",
        states: ["ID"],
        cities: ["Meridian"],
        counties: [],
        zipCodes: [],
        propertyTypes: ["SFR"],
        minPriceCents: null,
        maxPriceCents: BigInt(20_000_000),
        minSpreadCents: null,
        maxRepairCents: null,
      }),
    ).toBe(true);
    expect(
      propertyMatchesBuyBox(
        { ...meridian, estimatedValue: 250_000 },
        {
          name: "Meridian SFR",
          states: ["ID"],
          cities: ["Meridian"],
          counties: [],
          zipCodes: [],
          propertyTypes: ["SFR"],
          minPriceCents: null,
          maxPriceCents: BigInt(20_000_000),
          minSpreadCents: null,
          maxRepairCents: null,
        },
      ),
    ).toBe(false);
  });

  it("rejects properties without a cached price so junk does not become a Deal", () => {
    expect(
      propertyMatchesBuyBox(
        { ...meridian, estimatedValue: null },
        {
          name: "Meridian SFR",
          states: [],
          cities: [],
          counties: [],
          zipCodes: [],
          propertyTypes: [],
          minPriceCents: null,
          maxPriceCents: null,
          minSpreadCents: null,
          maxRepairCents: null,
        },
      ),
    ).toBe(false);
  });

  it("caps matches so a loose box cannot dump the whole inventory", () => {
    const properties = Array.from({ length: 40 }, (_, index) => ({
      ...meridian,
      id: `p${index}`,
      address: `${index} Oak St`,
    }));
    expect(
      selectBuyBoxMatches(properties, {
        name: "Loose",
        states: ["ID"],
        cities: [],
        counties: [],
        zipCodes: [],
        propertyTypes: [],
        minPriceCents: null,
        maxPriceCents: null,
        minSpreadCents: null,
        maxRepairCents: null,
      }).length,
    ).toBe(25);
  });
});
