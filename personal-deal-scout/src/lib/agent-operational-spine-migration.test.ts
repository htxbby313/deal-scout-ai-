import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "prisma/migrations/20260822140000_agent_operational_spine/migration.sql"), "utf8");

describe("agent operational spine migration", () => {
  it("is additive and persistently blocks executable red-zone tasks", () => {
    expect(migration).not.toMatch(/^\s*(DROP\b|TRUNCATE\b|DELETE\s+FROM\b)/im);
    expect(migration).toContain('CREATE TABLE "AgentSchedulerCycle"');
    expect(migration).toContain('CREATE TABLE "AgentCapabilityGrant"');
    expect(migration).toContain('AgentTask_red_not_executable_check');
    expect(migration).toContain("'PROFIT_UNDERWRITING'");
    expect(migration).toContain("'COMMUNICATIONS_DISPOSITION'");
  });
});
