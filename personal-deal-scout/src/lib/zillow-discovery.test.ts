import { describe, expect, it } from "vitest";
import {
  buildZillowSearchLink,
  compareDiscoveryObservation,
  normalizeZillowPropertyUrl,
  prepareZillowDiscoveryReference,
} from "@/lib/zillow-discovery";

describe("Zillow no-fetch discovery references", () => {
  it("normalizes a direct property URL without retaining tracking data", () => {
    expect(
      normalizeZillowPropertyUrl(
        "https://zillow.com/homedetails/123-Main-St-Austin-TX/123456_zpid/?utm_source=x#photo",
      ),
    ).toBe(
      "https://www.zillow.com/homedetails/123-Main-St-Austin-TX/123456_zpid/",
    );
  });

  it.each([
    "http://www.zillow.com/homedetails/a/1_zpid/",
    "https://evil.example/homedetails/a/1_zpid/",
    "https://www.zillow.com/homes/for_sale/",
    "https://user:pass@www.zillow.com/homedetails/a/1_zpid/",
  ])("rejects unsafe or non-property URLs: %s", (url) => {
    expect(() => normalizeZillowPropertyUrl(url)).toThrow();
  });

  it("keeps every owner observation explicitly unverified and performs no fetch", () => {
    expect(
      prepareZillowDiscoveryReference({
        url: "https://www.zillow.com/homedetails/a/1_zpid/",
        observedAskingPrice: 500000,
      }),
    ).toMatchObject({
      observedAskingPrice: 500000,
      verificationStatus: "USER_OBSERVED_UNVERIFIED",
      fetched: false,
    });
  });

  it("builds a link-out search from public location text only", () => {
    expect(buildZillowSearchLink("Austin, TX")).toBe(
      "https://www.zillow.com/homes/Austin%2C%20TX_rb/",
    );
  });

  it("records conflicts without promoting the observation to fact", () => {
    expect(
      compareDiscoveryObservation({
        observedAddress: "10 Main St",
        observedAskingPrice: 400000,
        officialAddress: "10 Main Street",
        officialAskingPrice: 350000,
      }),
    ).toMatchObject({
      status: "CONFLICT",
      conflicts: [{ field: "address" }, { field: "asking_price" }],
    });
  });
});
