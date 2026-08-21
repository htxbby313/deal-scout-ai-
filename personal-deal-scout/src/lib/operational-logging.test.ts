import { describe, expect, it, vi } from "vitest";
import { logOperation } from "@/lib/operational-logging";

describe("operational logging", () => {
  it("emits parseable JSON and redacts secret-bearing fields", () => {
    const output = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    logOperation("warn", "external_source_rate_limited", { host: "example.gov", authorization: "Bearer secret" });
    const entry = JSON.parse(String(output.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(entry).toMatchObject({ level: "warn", operation: "external_source_rate_limited", details: { host: "example.gov", authorization: "[REDACTED]" } });
    output.mockRestore();
  });
});
