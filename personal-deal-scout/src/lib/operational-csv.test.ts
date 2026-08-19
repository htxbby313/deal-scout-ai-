import { describe, expect, it } from "vitest";
import { __operationalCsvTestables } from "@/lib/operational-csv";

describe("operational CSV", () => {
  it("neutralizes spreadsheet formulas", () => {
    expect(__operationalCsvTestables.cell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
  });
});
