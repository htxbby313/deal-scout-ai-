import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function boundedInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

export function pooledDatabaseUrl(raw: string | undefined, environment = process.env.NODE_ENV) {
  if (!raw || !/^postgres(?:ql)?:\/\//i.test(raw)) return raw;
  const url = new URL(raw);
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", String(boundedInteger(process.env.DATABASE_POOL_MAX, environment === "production" ? 5 : 3, 1, 20)));
  if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", String(boundedInteger(process.env.DATABASE_POOL_TIMEOUT_SECONDS, 10, 1, 60)));
  if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", String(boundedInteger(process.env.DATABASE_CONNECT_TIMEOUT_SECONDS, 10, 1, 60)));
  return url.toString();
}

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      datasourceUrl: pooledDatabaseUrl(process.env.DATABASE_URL),
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      errorFormat: process.env.NODE_ENV === "development" ? "pretty" : "minimal",
    });
  }
  return globalForPrisma.prisma;
}

export const __prismaTestables = { boundedInteger };
