import { describe, expect, it } from "vitest";
import { classifyFunnelQueue, evaluateFunnelExpiration, nextReviewAt } from "@/lib/funnel-automation-policy";

describe("funnel expiration automation", () => {
  const now = new Date("2026-08-19T12:00:00Z"); const policy = { stage: "RESEARCHABLE" as const, reviewIntervalHours: 24, expiryAction: "NURTURE" as const, requiredGateTypes: ["PROPERTY_EVIDENCE"] };
  it("calculates configured review times", () => expect(nextReviewAt(new Date("2026-08-18T12:00:00Z"), 24)).toEqual(now));
  it("routes stale evidence to refresh instead of silently advancing", () => expect(evaluateFunnelExpiration({ stage: "RESEARCHABLE", stageHistoryId: "h1", controlStatus: "ACTIVE", nextReviewAt: now, openBlockers: [], missingOrStaleGates: ["PROPERTY_EVIDENCE"], policy, now }).action).toBe("REFRESH_RESEARCH"));
  it("never routes a stopped transaction", () => expect(evaluateFunnelExpiration({ stage: "RESEARCHABLE", stageHistoryId: "h1", controlStatus: "STOPPED", nextReviewAt: now, openBlockers: [], missingOrStaleGates: [], policy, now }).due).toBe(false));
  it("classifies blocked, expired, stalled and high-value queues independently", () => expect(classifyFunnelQueue({ nextReviewAt: now, openBlockers: 1, projectedBaseCents: BigInt(3_000_000), highValueThresholdCents: BigInt(2_500_000), lastActivityAt: new Date("2026-08-01"), now })).toEqual(["BLOCKED","EXPIRED","STALLED","HIGH_VALUE"]));
});
