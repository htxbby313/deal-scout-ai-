import { describe, expect, it } from "vitest";
import {
  evidenceFreshness,
  isSafePublicEvidenceUrl,
  nextAutomaticRetryAt,
  planAutomaticResearch,
} from "@/lib/research-freshness";

const now = new Date("2026-08-19T12:00:00.000Z");

describe("research evidence freshness", () => {
  it("accepts only HTTPS public evidence sources", () => {
    expect(isSafePublicEvidenceUrl("https://www.census.gov/data.json")).toBe(true);
    expect(isSafePublicEvidenceUrl("http://example.gov/record")).toBe(false);
    expect(isSafePublicEvidenceUrl("https://localhost/record")).toBe(false);
    expect(isSafePublicEvidenceUrl("https://192.168.1.10/record")).toBe(false);
    expect(isSafePublicEvidenceUrl("https://user:secret@example.gov/record")).toBe(false);
    expect(isSafePublicEvidenceUrl("not a URL")).toBe(false);
  });

  it("distinguishes stale, missing, invalid, and unsafe persisted evidence", () => {
    expect(evidenceFreshness({ topic: "LISTING", status: "VERIFIED", sourceUrl: "https://example.gov/1", observedAt: "2026-08-18T00:00:00Z" }, now, 7)).toBe("CURRENT");
    expect(evidenceFreshness({ topic: "LISTING", status: "VERIFIED", sourceUrl: "https://example.gov/1", observedAt: "2026-08-01T00:00:00Z" }, now, 7)).toBe("STALE");
    expect(evidenceFreshness({ topic: "LISTING", status: "NEEDS_MANUAL_VERIFICATION", sourceUrl: "https://example.gov/1", observedAt: now }, now, 7)).toBe("MISSING");
    expect(evidenceFreshness({ topic: "LISTING", status: "VERIFIED", sourceUrl: "http://example.gov/1", observedAt: now }, now, 7)).toBe("UNVERIFIED_SOURCE");
    expect(evidenceFreshness({ topic: "LISTING", status: "VERIFIED", sourceUrl: "https://example.gov/1", observedAt: "invalid" }, now, 7)).toBe("INVALID_DATE");
  });

  it("uses bounded exponential retry timing", () => {
    expect(nextAutomaticRetryAt("2026-08-19T10:00:00Z", 1)?.toISOString()).toBe("2026-08-19T10:15:00.000Z");
    expect(nextAutomaticRetryAt("2026-08-19T10:00:00Z", 3)?.toISOString()).toBe("2026-08-19T11:00:00.000Z");
    expect(nextAutomaticRetryAt("2026-08-19T10:00:00Z", 20)?.toISOString()).toBe("2026-08-20T10:00:00.000Z");
  });

  it("plans refresh for stale and missing topics without bypassing active runs", () => {
    const base = {
      evidence: [{ topic: "LISTING", status: "VERIFIED", sourceUrl: "https://example.gov/1", observedAt: "2026-08-18T00:00:00Z" }],
      expectedTopics: ["LISTING", "OWNERSHIP"],
      now,
      maxAgeDays: 7,
    };
    const due = planAutomaticResearch({ ...base, latestRun: { status: "COMPLETE", startedAt: "2026-08-18T00:00:00Z", finishedAt: "2026-08-18T00:01:00Z" } });
    expect(due).toMatchObject({ due: true, reasons: ["evidence_refresh_required"], staleTopics: ["OWNERSHIP"] });
    expect(planAutomaticResearch({ ...base, latestRun: { status: "QUEUED", startedAt: "2026-08-19T11:59:00Z" } }).due).toBe(false);
  });

  it("waits for retry backoff and recovers abandoned running work", () => {
    const waiting = planAutomaticResearch({ evidence: [], expectedTopics: ["CONTACT"], latestRun: { status: "FAILED", startedAt: "2026-08-19T11:45:00Z", finishedAt: "2026-08-19T11:55:00Z" }, consecutiveFailures: 1, now, maxAgeDays: 7 });
    expect(waiting.due).toBe(false);
    expect(waiting.retryAt?.toISOString()).toBe("2026-08-19T12:10:00.000Z");

    const abandoned = planAutomaticResearch({ evidence: [], expectedTopics: ["CONTACT"], latestRun: { status: "RUNNING", startedAt: "2026-08-19T10:00:00Z" }, now, maxAgeDays: 7 });
    expect(abandoned).toMatchObject({ due: true, recoverAbandonedRun: true });
    expect(abandoned.reasons).toContain("abandoned_run");
  });
});
