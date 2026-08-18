import { describe, expect, it } from "vitest";
import { rankColor, US_MAP_BOUNDS, US_STATE_CODES } from "@/lib/map-ranking";

describe("map ranking", () => {
  it("keeps number one at the selected base color and lightens lower ranks", () => {
    expect(rankColor("#2563eb", 0, 10)).toBe("#2563eb");
    expect(rankColor("#2563eb", 9, 10)).toBe("#cfddfb");
  });

  it("limits supported map states to the United States and District of Columbia", () => {
    expect(US_STATE_CODES.has("MS")).toBe(true);
    expect(US_STATE_CODES.has("DC")).toBe(true);
    expect(US_STATE_CODES.has("PR")).toBe(false);
    expect(US_MAP_BOUNDS).toEqual([[18, -179], [72, -60]]);
  });
});
