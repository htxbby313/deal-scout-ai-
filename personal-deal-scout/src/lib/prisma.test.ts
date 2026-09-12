import { describe, expect, it } from "vitest";
import { pooledDatabaseUrl, runtimeDatabaseUrl } from "@/lib/prisma";

describe("Prisma connection pooling", () => {
  it("adds bounded pool defaults without replacing explicit provider values", () => {
    const configured = new URL(pooledDatabaseUrl("postgresql://user:pass@example.com/db?sslmode=require", "production")!);
    expect(configured.searchParams.get("connection_limit")).toBe("5");
    expect(configured.searchParams.get("pool_timeout")).toBe("10");
    expect(configured.searchParams.get("sslmode")).toBe("require");
    const explicit = new URL(pooledDatabaseUrl("postgresql://user:pass@example.com/db?connection_limit=8", "production")!);
    expect(explicit.searchParams.get("connection_limit")).toBe("8");
  });

  it("prefers the current Neon integration over a legacy DATABASE_URL", () => {
    expect(runtimeDatabaseUrl({
      DATABASE_URL: "postgresql://legacy/db",
      NEON_POSTGRES_PRISMA_URL: "postgresql://current/db",
    })).toBe("postgresql://current/db");
    expect(runtimeDatabaseUrl({ DATABASE_URL: "postgresql://legacy/db" })).toBe("postgresql://legacy/db");
  });
});
