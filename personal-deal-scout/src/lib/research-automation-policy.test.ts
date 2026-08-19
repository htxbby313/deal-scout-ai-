import { describe, expect, it } from "vitest";

import { isAutomaticResearchTask, researchRetryDecision, researchRetryDelayMs } from "@/lib/research-automation-policy";

describe("automatic research policy", () => {
  it("classifies research without classifying outbound work", () => {
    expect(isAutomaticResearchTask("RESEARCH_PROPERTY")).toBe(true);
    expect(isAutomaticResearchTask("RESEARCH_DEVELOPER")).toBe(true);
    expect(isAutomaticResearchTask("SEND_OUTBOUND_MESSAGE")).toBe(false);
    expect(isAutomaticResearchTask("EXECUTE_CONTRACT")).toBe(false);
  });

  it("uses bounded exponential retry delays", () => {
    expect(researchRetryDelayMs(1)).toBe(15 * 60_000);
    expect(researchRetryDelayMs(2)).toBe(30 * 60_000);
    expect(researchRetryDelayMs(8)).toBe(2 * 60 * 60_000);
  });

  it("stops retrying after three attempts", () => {
    const decision = researchRetryDecision({ attemptCount: 3, failedAt: new Date(0), now: new Date(10_000_000) });
    expect(decision).toEqual({ retry: false, retryAt: null });
  });
});

