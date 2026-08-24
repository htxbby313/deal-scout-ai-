import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/20260824030000_comp_evidence_media_rights/migration.sql",
  "utf8",
);
describe("Deal Desk evidence migration", () => {
  it("is additive and preserves existing property/media records", () => {
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN|TYPE)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
    expect(migration).toContain('CREATE TABLE "ComparableSale"');
    expect(migration).toContain('ADD COLUMN "rightsStatus"');
    expect(migration).toContain(
      'FOREIGN KEY ("propertyId") REFERENCES "Property"',
    );
  });
});
