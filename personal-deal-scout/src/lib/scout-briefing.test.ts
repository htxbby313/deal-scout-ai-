import { describe, expect, it } from "vitest";
import { scoutBriefing } from "./scout-briefing";
import type { OwnerQueueItem } from "./funnel-owner-queue";

const item = (
  kind: OwnerQueueItem["kind"],
  label: string,
): OwnerQueueItem => ({
  id: label,
  kind,
  label,
  createdAt: new Date("2026-09-03T12:00:00Z"),
  urgent: false,
  href: "/deals/p1",
});

describe("scout home briefing", () => {
  it("names Buy Box matches and seller threads without a chat surface", () => {
    const brief = scoutBriefing([
      item("FUNNEL_BLOCKER", "Buy Box match · 214 Oak St"),
      item("FUNNEL_BLOCKER", "Buy Box match · 90 Pine"),
      item("FUNNEL_BLOCKER", "Buy Box match · 12 Elm"),
      item("SELLER_ENGAGEMENT", "SMS · 214 Oak St"),
    ]);
    expect(brief.headline).toBe("Scout: Buy Box match · 214 Oak St.");
    expect(brief.lines).toEqual([
      "3 new properties match your Buy Box.",
      "1 seller thread needs a decision.",
    ]);
  });

  it("stays quiet when the queue is empty", () => {
    expect(scoutBriefing([])).toEqual({
      headline: "Scout is watching. Nothing needs you right now.",
      lines: [],
    });
  });
});
