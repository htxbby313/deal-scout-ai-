import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("immutable history migration", () => {
  const sql = readFileSync(join(process.cwd(), "prisma/migrations/20260819255000_immutable_history_triggers/migration.sql"), "utf8");
  it.each(["TransactionOutcome", "FinancialProjection", "SettlementReview", "ProfitPriorityScoreHistory", "BuyerReliabilityScoreHistory"])("protects %s from update and delete", (table) => {
    expect(sql).toContain(`BEFORE UPDATE OR DELETE ON \"${table}\"`);
  });
  it("permits only the first stage exit timestamp update", () => {
    expect(sql).toContain('OLD."exitedAt" IS NULL');
    expect(sql).toContain("to_jsonb(NEW) - 'exitedAt'");
  });
});
