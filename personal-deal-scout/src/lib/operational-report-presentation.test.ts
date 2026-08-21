import { describe, expect, it } from "vitest";
import type { Metric } from "@/lib/operational-kpis";
import {
  hasActiveOperationalFilters,
  metricCalculationDetails,
  OPERATIONAL_REPORT_SECTIONS,
  operationalScopeParts,
  organizeOperationalMetrics,
  parseOperationalReportFilters,
} from "@/lib/operational-report-presentation";

const metric = (
  key: string,
  value: number | string | null = 1,
  numerator: number | string | null = 1,
  denominator: number | string | null = 2,
  unit: Metric["unit"] = "count",
): Metric => ({
  key,
  label: key,
  definition: `${key} definition`,
  value,
  numerator,
  denominator,
  unit,
  sampleSize: 2,
  windowStart: "2026-07-22T00:00:00.000Z",
  windowEnd: "2026-08-21T00:00:00.000Z",
  lastRefresh: "2026-08-21T00:00:00.000Z",
});

describe("operational report presentation", () => {
  it("renders all 48 current metrics exactly once", () => {
    const keys = OPERATIONAL_REPORT_SECTIONS.flatMap((section) => [
      ...section.keys,
    ]);
    expect(keys).toHaveLength(48);
    expect(new Set(keys).size).toBe(48);
    const rendered = organizeOperationalMetrics(
      keys.map((key) => metric(key)),
    ).flatMap((section) => section.metrics.map((item) => item.key));
    expect(rendered).toEqual(keys);
  });

  it("renders future unmatched metrics once through the fallback", () => {
    const sections = organizeOperationalMetrics([
      metric("properties_discovered"),
      metric("future_metric"),
    ]);
    expect(
      sections.flatMap((section) => section.metrics).map((item) => item.key),
    ).toEqual(["properties_discovered", "future_metric"]);
    expect(sections.at(-1)).toMatchObject({
      title: "Additional operational metrics",
      fallback: true,
    });
  });

  it.each([
    [
      "research_completion_rate",
      "Researched properties",
      "Discovered properties",
      "50%",
    ],
    [
      "buyer_closing_rate",
      "Verified completed closings",
      "Completed plus failed closings",
      "50%",
    ],
    ["cost_per_offer", "Attributed costs", "Offers prepared", "$12.34"],
    [
      "cost_per_seller_reached",
      "Qualifying acquisition cost",
      "Unique sellers reached",
      "$12.34",
    ],
    [
      "cost_per_closed_transaction",
      "Attributed costs",
      "Closed transactions",
      "$12.34",
    ],
  ])(
    "discloses inputs and formatting for %s",
    (key, numeratorLabel, denominatorLabel, formatted) => {
      const item = metric(
        key,
        key.startsWith("cost") ? "1234" : 50,
        key.startsWith("cost") ? "1234" : 1,
        2,
        key.startsWith("cost") ? "cents" : "percent",
      );
      const details = metricCalculationDetails(item);
      expect(details.numerator).toEqual({
        label: numeratorLabel,
        value: key.startsWith("cost") ? "$12.34" : "1",
      });
      expect(details.denominator).toEqual({
        label: denominatorLabel,
        value: "2",
      });
      expect(details.formula).toBeTruthy();
      expect(
        key.startsWith("cost") ? details.numerator?.value : `${item.value}%`,
      ).toBe(formatted);
    },
  );

  it("keeps zero distinct from missing and omits unused inputs", () => {
    expect(
      metricCalculationDetails(metric("offers_prepared", 0, 0, null)),
    ).toMatchObject({ numerator: { value: "0" }, denominator: null });
    expect(
      metricCalculationDetails(metric("offers_prepared", null, null, null)),
    ).toMatchObject({ numerator: null, denominator: null });
  });

  it("uses the same canonical state for URL and form filters", () => {
    const url = parseOperationalReportFilters(
      new URLSearchParams("state=TX&stage=CONTRACTED&buyerId=b1"),
    );
    const form = parseOperationalReportFilters([
      ["state", "TX"],
      ["stage", "CONTRACTED"],
      ["buyerId", "b1"],
    ]);
    expect(hasActiveOperationalFilters(url)).toBe(true);
    expect(operationalScopeParts(url)).toContain("Market: TX");
    expect(parseOperationalReportFilters(new URLSearchParams())).toEqual({});
    expect(hasActiveOperationalFilters({})).toBe(false);
    expect(form).toEqual(url);
  });

  it("shows every active report dimension and omits inactive optional dimensions", () => {
    const scope = operationalScopeParts({
      propertyType: "LAND",
      leadSource: "county_record",
      transactionStructure: "assignment_contract",
    });
    expect(scope).toContain("Property type: Land");
    expect(scope).toContain("Lead source: County Record");
    expect(scope).toContain("Transaction structure: Assignment Contract");
    expect(
      operationalScopeParts({}).some((part) =>
        part.startsWith("Property type:"),
      ),
    ).toBe(false);
  });

  it("uses duration-specific calculation language", () => {
    expect(
      metricCalculationDetails(
        metric("average_stage_hours", 5, 20, 4, "hours"),
      ),
    ).toMatchObject({
      kind: "AVERAGE_DURATION",
      numerator: { label: "Total duration", value: "20 hours" },
      denominator: null,
      formula: "Total duration ÷ completed observations",
    });
    const median = metricCalculationDetails(
      metric("median_stage_hours", 5, 4, null, "hours"),
    );
    expect(median.kind).toBe("MEDIAN_DURATION");
    expect(median.numerator).toBeNull();
    expect(median.formula).toContain("Middle ordered duration");
  });
});
