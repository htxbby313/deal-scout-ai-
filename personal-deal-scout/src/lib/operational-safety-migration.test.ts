import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("prisma/migrations/20260821043000_operational_safety_controls/migration.sql", "utf8");

describe("operational safety migration", () => {
  it("adds bounded retry state and persisted blocker codes without destructive statements", () => {
    expect(migration).toContain('"attemptCount" INTEGER NOT NULL DEFAULT 0');
    expect(migration).toContain('"maxAttempts" INTEGER NOT NULL DEFAULT 3');
    expect(migration).toContain('"exhausted" BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('"blockerCodes" TEXT[] NOT NULL');
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE)\b/i);
  });
});
