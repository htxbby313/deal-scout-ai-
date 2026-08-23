import "server-only";

import { getPrisma } from "@/lib/prisma";

const DEFAULT_MONTHLY_LIMIT = 100;
const MAX_CONFIGURABLE_MONTHLY_LIMIT = 3_000;
const RESERVATION_TYPE = "research.enformion_lookup_reserved";

export function enformionMonthlyLimit(raw = process.env.ENFORMION_MONTHLY_MATCH_LIMIT) {
  if (!raw?.trim()) return DEFAULT_MONTHLY_LIMIT;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_CONFIGURABLE_MONTHLY_LIMIT) return DEFAULT_MONTHLY_LIMIT;
  return parsed;
}

function currentUtcMonth(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end, key: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}` };
}

export async function reserveEnformionLookup(propertyId: string, now = new Date()) {
  const db = getPrisma();
  const limit = enformionMonthlyLimit();
  const month = currentUtcMonth(now);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(1746366529)`;
    const used = await tx.auditLog.count({ where: { type: RESERVATION_TYPE, createdAt: { gte: month.start, lt: month.end } } });
    if (used >= limit) return { reserved: false as const, used, limit, month: month.key };
    await tx.auditLog.create({ data: { type: RESERVATION_TYPE, summary: "Reserved one Enformion property lookup within the configured monthly budget.", details: { propertyId, month: month.key, reservationNumber: used + 1, monthlyLimit: limit } } });
    return { reserved: true as const, used: used + 1, limit, month: month.key };
  });
}

export const __enformionBudgetTestables = { currentUtcMonth, DEFAULT_MONTHLY_LIMIT, MAX_CONFIGURABLE_MONTHLY_LIMIT };
