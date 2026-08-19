import { describe, expect, it } from "vitest";
import { serializeAccountingCsv } from "@/lib/accounting-export";

describe("accounting CSV export", () => {
  it("includes evidence and reproducibility metadata", () => {
    const result = serializeAccountingCsv([{ transactionId: "tx1", settlementArtifactId: "sa1", artifactHash: "abc", reviewer: "owner", reviewedAt: "2026-08-18T00:00:00.000Z", closingDate: "2026-08-17T00:00:00.000Z", assignmentFee: 15_000, correctionCount: 0 }], new Date("2026-08-19T12:00:00.000Z"));
    expect(result.rowCount).toBe(1);
    expect(result.csv).toContain("exportSchemaVersion,exportGeneratedAt,sourceSystem");
    expect(result.csv).toContain("abc");
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it("neutralizes spreadsheet formulas", () => {
    const result = serializeAccountingCsv([{ transactionId: "=cmd", settlementArtifactId: "sa1", artifactHash: "abc", reviewer: "owner", reviewedAt: "date", closingDate: "date", correctionCount: 0 }]);
    expect(result.csv).toContain("'=cmd");
  });
});
