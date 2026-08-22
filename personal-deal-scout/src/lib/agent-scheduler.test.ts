import { describe, expect, it } from "vitest";
import { nextDailyRun, schedulerHealthFromLatest } from "@/lib/agent-scheduler";

const cycle = (finishedAt: Date | null, status = "COMPLETED") => ({ id: "cycle-1", trigger: "CRON", status, startedAt: new Date("2026-08-21T07:00:00Z"), finishedAt, tasksCreated: 12, tasksProcessed: 12, tasksCompleted: 10, tasksFailed: 0, tasksWaitingApproval: 2 });

describe("agent scheduler health", () => {
  it("reports healthy only for a recent completed cycle", () => {
    expect(schedulerHealthFromLatest(cycle(new Date("2026-08-21T07:10:00Z")), new Date("2026-08-22T07:00:00Z")).healthy).toBe(true);
    expect(schedulerHealthFromLatest(cycle(new Date("2026-08-20T07:10:00Z")), new Date("2026-08-22T12:00:00Z")).healthy).toBe(false);
    expect(schedulerHealthFromLatest(cycle(null, "RUNNING"), new Date("2026-08-22T12:00:00Z")).healthy).toBe(false);
  });

  it("calculates the next 07:00 UTC recovery run", () => {
    expect(nextDailyRun(new Date("2026-08-22T06:59:00Z")).toISOString()).toBe("2026-08-22T07:00:00.000Z");
    expect(nextDailyRun(new Date("2026-08-22T07:01:00Z")).toISOString()).toBe("2026-08-23T07:00:00.000Z");
  });
});
