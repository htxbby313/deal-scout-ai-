import "server-only";

import { Prisma } from "@prisma/client";

import {
  estimateRehab,
  REHAB_CATEGORIES,
  type DealStrategy,
  type RehabMode,
} from "@/lib/deal-analysis";
import { selectCanonicalTransaction } from "@/lib/deal";
import { getPrisma } from "@/lib/prisma";
import { createControlledTransaction } from "@/lib/transaction-control";

/**
 * Rehab is an Estimate, not a contractor bid. Strategy profit (Wholesale /
 * Flip / BRRRR / Rental) is a Deal Box number that is intentionally separate
 * from seller-safe maximum / assignment projected spread in
 * src/lib/financial-truth.ts. Saving these assumptions must never change
 * that math — this module only persists inputs to the pure, already-existing
 * estimateRehab / analyzeDealStrategy functions in src/lib/deal-analysis.ts.
 */
export const DEAL_ASSUMPTIONS_SCHEMA_VERSION = 1 as const;

export type DealAssumptionsRecord = {
  version: typeof DEAL_ASSUMPTIONS_SCHEMA_VERSION;
  strategy: DealStrategy;
  rehabMode: RehabMode;
  squareFeet: number | null;
  ratePerSquareFootCents: string | null;
  customCents: Record<string, string> | null;
  contingencyBps: number;
  acquisitionCents: string | null;
  transactionCostsCents: string;
  financingCostsCents: string;
  holdingCostsCents: string;
  riskReserveCents: string;
  assignmentFeeCents: string;
  monthlyRentCents: string;
  monthlyExpensesCents: string;
  updatedAt: string;
  updatedBy: string;
};

export type DealAssumptionsInput = {
  strategy: DealStrategy;
  rehabMode: RehabMode;
  squareFeet?: number | null;
  ratePerSquareFootCents?: bigint | null;
  customCents?: Partial<Record<string, bigint>>;
  contingencyBps?: number;
  acquisitionCents?: bigint | null;
  transactionCostsCents?: bigint;
  financingCostsCents?: bigint;
  holdingCostsCents?: bigint;
  riskReserveCents?: bigint;
  assignmentFeeCents?: bigint;
  monthlyRentCents?: bigint;
  monthlyExpensesCents?: bigint;
  updatedBy: string;
};

const STRATEGIES: readonly DealStrategy[] = [
  "WHOLESALE",
  "FLIP",
  "BRRRR",
  "RENTAL",
];
const REHAB_MODES: readonly RehabMode[] = [
  "COSMETIC",
  "MODERATE",
  "HEAVY",
  "CUSTOM",
];

export function serializeDealAssumptions(
  input: DealAssumptionsInput,
): DealAssumptionsRecord {
  if (!input.updatedBy.trim())
    throw new Error("An actor is required to save deal assumptions.");
  const customCents =
    input.rehabMode === "CUSTOM"
      ? Object.fromEntries(
          REHAB_CATEGORIES.map((category) => [
            category,
            (input.customCents?.[category] ?? BigInt(0)).toString(),
          ]),
        )
      : null;
  return {
    version: DEAL_ASSUMPTIONS_SCHEMA_VERSION,
    strategy: input.strategy,
    rehabMode: input.rehabMode,
    squareFeet:
      input.squareFeet != null && Number.isFinite(input.squareFeet)
        ? Math.max(0, Math.round(input.squareFeet))
        : null,
    ratePerSquareFootCents: input.ratePerSquareFootCents?.toString() ?? null,
    customCents,
    contingencyBps: input.contingencyBps ?? 1000,
    acquisitionCents: input.acquisitionCents?.toString() ?? null,
    transactionCostsCents: (input.transactionCostsCents ?? BigInt(0)).toString(),
    financingCostsCents: (input.financingCostsCents ?? BigInt(0)).toString(),
    holdingCostsCents: (input.holdingCostsCents ?? BigInt(0)).toString(),
    riskReserveCents: (input.riskReserveCents ?? BigInt(0)).toString(),
    assignmentFeeCents: (input.assignmentFeeCents ?? BigInt(0)).toString(),
    monthlyRentCents: (input.monthlyRentCents ?? BigInt(0)).toString(),
    monthlyExpensesCents: (input.monthlyExpensesCents ?? BigInt(0)).toString(),
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy.trim(),
  };
}

/** Fail closed: unrecognized/corrupt JSON hydrates to null, never invented numbers. */
export function parseDealAssumptions(
  raw: unknown,
): DealAssumptionsRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.version !== DEAL_ASSUMPTIONS_SCHEMA_VERSION) return null;
  if (!STRATEGIES.includes(value.strategy as DealStrategy)) return null;
  if (!REHAB_MODES.includes(value.rehabMode as RehabMode)) return null;
  const bigintString = (input: unknown) => {
    if (typeof input !== "string") return null;
    try {
      BigInt(input);
      return input;
    } catch {
      return null;
    }
  };
  const requiredCents = [
    "transactionCostsCents",
    "financingCostsCents",
    "holdingCostsCents",
    "riskReserveCents",
    "assignmentFeeCents",
    "monthlyRentCents",
    "monthlyExpensesCents",
  ] as const;
  for (const key of requiredCents) {
    if (bigintString(value[key]) == null) return null;
  }
  let customCents: Record<string, string> | null = null;
  if (value.customCents && typeof value.customCents === "object") {
    customCents = {};
    for (const category of REHAB_CATEGORIES) {
      const entry = (value.customCents as Record<string, unknown>)[category];
      customCents[category] = bigintString(entry) ?? "0";
    }
  }
  return {
    version: DEAL_ASSUMPTIONS_SCHEMA_VERSION,
    strategy: value.strategy as DealStrategy,
    rehabMode: value.rehabMode as RehabMode,
    squareFeet:
      typeof value.squareFeet === "number" ? value.squareFeet : null,
    ratePerSquareFootCents: bigintString(value.ratePerSquareFootCents),
    customCents,
    contingencyBps:
      typeof value.contingencyBps === "number" ? value.contingencyBps : 1000,
    acquisitionCents: bigintString(value.acquisitionCents),
    transactionCostsCents: value.transactionCostsCents as string,
    financingCostsCents: value.financingCostsCents as string,
    holdingCostsCents: value.holdingCostsCents as string,
    riskReserveCents: value.riskReserveCents as string,
    assignmentFeeCents: value.assignmentFeeCents as string,
    monthlyRentCents: value.monthlyRentCents as string,
    monthlyExpensesCents: value.monthlyExpensesCents as string,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
    updatedBy: typeof value.updatedBy === "string" ? value.updatedBy : "",
  };
}

export function estimateRehabFromAssumptions(
  assumptions: DealAssumptionsRecord,
) {
  return estimateRehab({
    mode: assumptions.rehabMode,
    squareFeet: assumptions.squareFeet ?? 0,
    ratePerSquareFootCents: assumptions.ratePerSquareFootCents
      ? BigInt(assumptions.ratePerSquareFootCents)
      : undefined,
    customCents: assumptions.customCents
      ? Object.fromEntries(
          Object.entries(assumptions.customCents).map(([category, cents]) => [
            category,
            BigInt(cents),
          ]),
        )
      : undefined,
    contingencyBps: assumptions.contingencyBps,
  });
}

/**
 * Persists rehab/strategy assumptions on the canonical DealTransaction for a
 * property (creating one on owner hold via createControlledTransaction if
 * none exists yet — no trip to /profitability required). This never touches
 * FinancialProjection rows or sellerSafeMaximumCents.
 */
export async function saveDealAssumptions(
  input: DealAssumptionsInput & { propertyId: string },
) {
  const db = getPrisma();
  const existing = await db.dealTransaction.findMany({
    where: { propertyId: input.propertyId },
    orderBy: { createdAt: "desc" },
  });
  const canonical = selectCanonicalTransaction(existing);
  const transaction =
    canonical ??
    (await createControlledTransaction({
      propertyId: input.propertyId,
      actor: input.updatedBy,
    }));
  const record = serializeDealAssumptions(input);
  const updated = await db.dealTransaction.update({
    where: { id: transaction.id },
    data: { dealAssumptions: record as unknown as Prisma.InputJsonValue },
  });
  return { transactionId: updated.id, assumptions: record };
}
