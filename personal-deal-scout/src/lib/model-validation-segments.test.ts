import { describe, expect, it } from "vitest";
import { buildSegmentedForecastErrors } from "./model-validation";

describe("segmented forecast errors", () => {
  it("reports every required dimension without inventing missing labels", () => {
    const rows = buildSegmentedForecastErrors([{ status: "CLOSED_ASSIGNED", assignmentFee: 12_000, predictedAssignmentFee: 10_000, predictedProbabilityBps: 8_000, market: "Austin", buyer: "Buyer A" }]);
    expect(rows.find((row) => row.dimension === "market" && row.key === "Austin")?.meanAbsoluteFinancialError).toBe(2_000);
    expect(rows.find((row) => row.dimension === "buyer" && row.key === "Buyer A")?.meanAbsoluteProbabilityErrorBps).toBe(2_000);
    expect(rows.find((row) => row.dimension === "leadSource")?.key).toBe("UNSPECIFIED");
  });
});
