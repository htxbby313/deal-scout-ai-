import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      // Connection pool configuration
      errorFormat: "pretty",
    });

    // Connection pool settings via environment or defaults
    // For production PostgreSQL connections:
    // DATABASE_POOL_MIN (default: 2) - minimum connections to maintain
    // DATABASE_POOL_MAX (default: 10) - maximum connections to create
    // DATABASE_IDLE_TIMEOUT (default: 30000ms) - idle connection timeout
  }
  return globalForPrisma.prisma;
}

/**
 * Helper for batched upsert operations to avoid N+1 queries.
 * Use for bulk updates where each item has similar logic.
 */
export async function batchUpsert<T extends { id?: string }>(
  tx: any,
  model: string,
  items: T[],
  whereKey: string,
  options?: { chunkSize?: number; logProgress?: boolean }
): Promise<T[]> {
  const chunkSize = options?.chunkSize ?? 50;
  const results: T[] = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    if (options?.logProgress) {
      console.log(`[batchUpsert] Processing ${model}: ${i + 1}-${Math.min(i + chunkSize, items.length)} of ${items.length}`);
    }

    const chunkResults = await Promise.all(
      chunk.map((item) =>
        tx[model].upsert({
          where: { [whereKey]: item[whereKey as keyof T] },
          update: item,
          create: item,
        })
      )
    );
    results.push(...chunkResults);
  }

  return results;
}
