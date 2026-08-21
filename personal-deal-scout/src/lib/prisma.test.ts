import { describe, expect, it } from "vitest";
import { pooledDatabaseUrl } from "@/lib/prisma";

describe("Prisma connection pooling", () => {
  it("adds bounded pool defaults without replacing explicit provider values", () => {
    const configured = new URL(pooledDatabaseUrl("postgresql://user:pass@example.com/db?sslmode=require", "production")!);
    expect(configured.searchParams.get("connection_limit")).toBe("5");
    expect(configured.searchParams.get("pool_timeout")).toBe("10");
    expect(configured.searchParams.get("sslmode")).toBe("require");
    const explicit = new URL(pooledDatabaseUrl("postgresql://user:pass@example.com/db?connection_limit=8", "production")!);
    expect(explicit.searchParams.get("connection_limit")).toBe("8");
  });
});
