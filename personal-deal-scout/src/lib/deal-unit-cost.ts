export const ENFORMION_LOOKUP_RESERVED_TYPE =
  "research.enformion_lookup_reserved";

/** Bounded scan of reservation audit rows. Avoids JSON-path table scans. */
export const ENFORMION_RESERVATION_SCAN_CAP = 5_000;

export type DealUnitCost = {
  agentTaskCostCents: bigint;
  enformionReservations: number;
};

export type ClosedDealOutcome = {
  status: string;
  assignmentFee?: number | null;
  cycleDays?: number | null;
};

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const OUTCOME_STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  CLOSED_ASSIGNED: "Closed assigned",
  CLOSED_PURCHASED: "Closed purchased",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
};

export function formatUsdFromCents(cents: bigint | number): string {
  return usd.format(Number(cents) / 100);
}

export function reservationPropertyId(details: unknown): string | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return null;
  }
  const propertyId = (details as { propertyId?: unknown }).propertyId;
  return typeof propertyId === "string" ? propertyId : null;
}

export function countEnformionReservationsForProperty(
  rows: readonly { details?: unknown }[],
  propertyId: string,
): number {
  return rows.filter((row) => reservationPropertyId(row.details) === propertyId)
    .length;
}

export function assembleDealUnitCost(input: {
  agentTaskCostCents: bigint | number | null | undefined;
  reservationRows: readonly { details?: unknown }[];
  propertyId: string;
}): DealUnitCost {
  return {
    agentTaskCostCents:
      input.agentTaskCostCents == null
        ? BigInt(0)
        : BigInt(input.agentTaskCostCents),
    enformionReservations: countEnformionReservationsForProperty(
      input.reservationRows,
      input.propertyId,
    ),
  };
}

export function formatClosedOutcomeLine(
  outcome: ClosedDealOutcome | null | undefined,
): string | null {
  if (!outcome || outcome.status === "OPEN") return null;
  const parts = [
    OUTCOME_STATUS_LABEL[outcome.status] ??
      outcome.status.replaceAll("_", " "),
  ];
  if (outcome.assignmentFee != null) {
    parts.push(`assignment fee ${formatUsdFromCents(outcome.assignmentFee)}`);
  }
  if (outcome.cycleDays != null) {
    parts.push(
      `${outcome.cycleDays} cycle ${outcome.cycleDays === 1 ? "day" : "days"}`,
    );
  }
  return `Closed outcome (realized): ${parts.join(" · ")}`;
}

export function formatResearchSpendLine(unitCost: DealUnitCost): string {
  const hasTaskCost = unitCost.agentTaskCostCents > BigInt(0);
  const hasPulls = unitCost.enformionReservations > 0;
  if (!hasTaskCost && !hasPulls) {
    return "No metered research spend recorded";
  }
  const parts: string[] = [];
  if (hasTaskCost) {
    parts.push(
      `${formatUsdFromCents(unitCost.agentTaskCostCents)} estimated agent-task cost`,
    );
  }
  if (hasPulls) {
    parts.push(
      `${unitCost.enformionReservations} Enformion ${
        unitCost.enformionReservations === 1 ? "pull" : "pulls"
      }`,
    );
  }
  return `Research spend: ${parts.join(" · ")}`;
}
