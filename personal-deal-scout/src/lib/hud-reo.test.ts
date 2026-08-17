import { describe, expect, it } from "vitest";

import { __hudTestables, hudRecordSourceUrl } from "./hud-reo";

const listing = { attributes: { OBJECTID: 1, CASE_NUM: "011-462670", CASE_STEP_NUMBER: 6, ADDRESS: "1904 BROADWAY ST", CITY: "GADSDEN", STATE_CODE: "AL", DISPLAY_ZIP_CODE: 35904, DATE_ACQUIRED: 1583280000000, MAP_LATITUDE: 33.997835, MAP_LONGITUDE: -86.033247 } };

describe("HUD REO connector", () => {
  it("accepts only public step-6 HUD records", () => {
    expect(__hudTestables.hudResponseSchema.parse({ features: [listing] }).features).toHaveLength(1);
    expect(() => __hudTestables.hudResponseSchema.parse({ features: [{ attributes: { ...listing.attributes, CASE_STEP_NUMBER: 5 } }] })).toThrow();
  });

  it("builds record-specific official evidence URLs", () => {
    const url = new URL(hudRecordSourceUrl(42));
    expect(url.hostname).toBe("egis.hud.gov");
    expect(url.searchParams.get("objectIds")).toBe("42");
  });

  it("records HUD acquisition dates without relabeling them as listing dates", () => {
    expect(__hudTestables.dateFromEpoch(1583280000000)).toBe("2020-03-04");
    expect(__hudTestables.dateFromEpoch(null)).toBeUndefined();
  });
});
