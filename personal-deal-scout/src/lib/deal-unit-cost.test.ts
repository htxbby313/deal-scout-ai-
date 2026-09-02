import { describe, expect, it } from "vitest";
import {
  assembleDealUnitCost,
  countEnformionReservationsForProperty,
  formatClosedOutcomeLine,
  formatResearchSpendLine,
  formatUsdFromCents,
} from "@/lib/deal-unit-cost";

describe("deal unit cost", () => {
  it("sums null agent-task cents as zero and counts matching reservation details", () => {
    expect(
      assembleDealUnitCost({
        agentTaskCostCents: null,
        propertyId: "prop-1",
        reservationRows: [
          { details: { propertyId: "prop-1" } },
          { details: { propertyId: "prop-2" } },
          { details: { month: "2026-09" } },
          { details: null },
        ],
      }),
    ).toEqual({
      agentTaskCostCents: BigInt(0),
      enformionReservations: 1,
    });
  });

  it("preserves bigint agent-task cents", () => {
    expect(
      assembleDealUnitCost({
        agentTaskCostCents: BigInt(1234),
        propertyId: "prop-1",
        reservationRows: [{ details: { propertyId: "prop-1" } }],
      }),
    ).toEqual({
      agentTaskCostCents: BigInt(1234),
      enformionReservations: 1,
    });
  });

  it("ignores reservation rows whose details are not an object with propertyId", () => {
    expect(
      countEnformionReservationsForProperty(
        [
          { details: "prop-1" },
          { details: ["prop-1"] },
          { details: { propertyId: 12 } },
        ],
        "prop-1",
      ),
    ).toBe(0);
  });
});

describe("deal box copy", () => {
  it("formats realized closed outcomes and never calls them earned", () => {
    expect(formatClosedOutcomeLine(null)).toBeNull();
    expect(formatClosedOutcomeLine({ status: "OPEN" })).toBeNull();
    expect(
      formatClosedOutcomeLine({
        status: "CLOSED_ASSIGNED",
        assignmentFee: 1_500_000,
        cycleDays: 42,
      }),
    ).toBe(
      "Closed outcome (realized): Closed assigned · assignment fee $15,000.00 · 42 cycle days",
    );
    expect(
      formatClosedOutcomeLine({ status: "FAILED", cycleDays: 1 }),
    ).toBe("Closed outcome (realized): Failed · 1 cycle day");
  });

  it("formats research spend only when metered cost or Enformion pulls exist", () => {
    expect(
      formatResearchSpendLine({
        agentTaskCostCents: BigInt(0),
        enformionReservations: 0,
      }),
    ).toBe("No metered research spend recorded");
    expect(
      formatResearchSpendLine({
        agentTaskCostCents: BigInt(250),
        enformionReservations: 0,
      }),
    ).toBe("Research spend: $2.50 estimated agent-task cost");
    expect(
      formatResearchSpendLine({
        agentTaskCostCents: BigInt(0),
        enformionReservations: 2,
      }),
    ).toBe("Research spend: 2 Enformion pulls");
    expect(
      formatResearchSpendLine({
        agentTaskCostCents: BigInt(100),
        enformionReservations: 1,
      }),
    ).toBe("Research spend: $1.00 estimated agent-task cost · 1 Enformion pull");
  });

  it("formats cents as USD", () => {
    expect(formatUsdFromCents(0)).toBe("$0.00");
    expect(formatUsdFromCents(BigInt(99))).toBe("$0.99");
  });
});
