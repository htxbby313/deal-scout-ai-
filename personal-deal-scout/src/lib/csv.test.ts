import { describe, expect, it } from "vitest";
import { __testables } from "@/lib/database";

describe("CSV parsing", () => {
  it("preserves blank fields and quoted commas", () => {
    expect(__testables.parseCsvLine('Acme Homes,,"Houston, TX",77002')).toEqual(["Acme Homes", "", "Houston, TX", "77002"]);
  });

  it("maps values to a header row", () => {
    expect(__testables.parseCsvRows("Company Name,Email,Notes\nAcme,,\"Buys land, cash\""))[0]).toEqual({
      "Company Name": "Acme",
      Email: "",
      Notes: "Buys land, cash",
    });
  });
});
