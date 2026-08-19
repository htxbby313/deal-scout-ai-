import { describe, expect, it } from "vitest";
import { agentTaskDedupeKey } from "./agent-task-dedup";

describe("agent task idempotency", () => {
  it("generates the same key for concurrent equivalent work in one cycle", () => {
    const input = { agentId: "agent", taskType: "MATCH_BUYER", transactionId: "deal", propertyId: "property", now: new Date("2026-08-19T12:00:00Z") };
    expect(agentTaskDedupeKey(input)).toBe(agentTaskDedupeKey(input));
    expect(agentTaskDedupeKey({ ...input, developerId: "buyer" })).not.toBe(agentTaskDedupeKey(input));
  });
});
