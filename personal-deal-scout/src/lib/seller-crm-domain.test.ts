import { describe, expect, it } from "vitest";
import {
  EngagementChannel,
  SellerContactAttemptStatus,
  SellerDispositionReason,
  SellerEngagementStatus,
  SellerFollowUpStatus,
} from "@prisma/client";
import {
  classifyContactAttempt,
  engagementChannels,
  firstActionableFollowUp,
  isEngagementVisibleInView,
  paginateTimeline,
  parseEnumValue,
  parseLines,
  selectVisibleEngagement,
  sellerDispositionReasons,
  sellerNextAction,
} from "@/lib/seller-crm-domain";

describe("seller CRM domain safeguards", () => {
  it("submits and validates every persisted enum value", () => {
    expect(
      engagementChannels.map((value) =>
        parseEnumValue(value, engagementChannels, "Channel"),
      ),
    ).toEqual(Object.values(EngagementChannel));
    expect(
      sellerDispositionReasons.map((value) =>
        parseEnumValue(value, sellerDispositionReasons, "Reason"),
      ),
    ).toEqual(Object.values(SellerDispositionReason));
    expect(() =>
      parseEnumValue("Email", engagementChannels, "Channel"),
    ).toThrow("Channel is invalid");
  });

  it("selects only visible engagements", () => {
    expect(selectVisibleEngagement([], "hidden")).toBeNull();
    expect(selectVisibleEngagement([{ id: "visible" }], "hidden")).toEqual({
      id: "visible",
    });
  });

  it("makes missing and explicit open views identical", () => {
    for (const status of Object.values(SellerEngagementStatus))
      expect(isEngagementVisibleInView(status)).toBe(
        isEngagementVisibleInView(status, "open"),
      );
    expect(isEngagementVisibleInView(SellerEngagementStatus.COMPLETED)).toBe(
      false,
    );
    expect(isEngagementVisibleInView(SellerEngagementStatus.CANCELLED)).toBe(
      false,
    );
  });

  it("parses objections and questions one nonblank line at a time", () => {
    expect(parseLines(" Price is low.\r\n\nNeed 30 days? \n  ")).toEqual([
      "Price is low.",
      "Need 30 days?",
    ]);
    expect(parseLines("")).toEqual([]);
  });

  it("prioritizes due and scheduled follow-ups and ignores terminal rows", () => {
    const rows = [
      { status: SellerFollowUpStatus.COMPLETED, dueAt: new Date("2026-01-01") },
      { status: SellerFollowUpStatus.SCHEDULED, dueAt: new Date("2026-01-02") },
      { status: SellerFollowUpStatus.DUE, dueAt: new Date("2026-01-03") },
    ];
    expect(firstActionableFollowUp(rows)?.status).toBe(
      SellerFollowUpStatus.DUE,
    );
    expect(
      firstActionableFollowUp(
        rows.filter((row) => row.status === SellerFollowUpStatus.COMPLETED),
      ),
    ).toBeNull();
  });

  it("recommends only actionable follow-ups and otherwise schedules the next one", () => {
    const base = {
      controlStatus: "ACTIVE",
      consentStatus: "GRANTED",
      conversationCount: 1,
      sellerFactCount: 1,
      engagementStatus: "OWNER_APPROVED",
      latestOfferStatus: "OWNER_APPROVED",
    };
    expect(
      sellerNextAction({
        ...base,
        followUps: [
          {
            status: SellerFollowUpStatus.COMPLETED,
            dueAt: new Date("2026-01-01"),
            reason: "Old",
          },
        ],
      })[0],
    ).toBe("Schedule the next follow-up");
    expect(
      sellerNextAction({
        ...base,
        followUps: [
          {
            status: SellerFollowUpStatus.SCHEDULED,
            dueAt: new Date("2026-01-01"),
            reason: "Later",
          },
          {
            status: SellerFollowUpStatus.DUE,
            dueAt: new Date("2026-01-02"),
            reason: "Due now",
          },
        ],
      })[1],
    ).toContain("Due now");
  });

  it.each([
    SellerContactAttemptStatus.DRAFT,
    SellerContactAttemptStatus.APPROVED_NOT_SENT,
  ])("renders %s as unsent workflow", (status) => {
    const event = classifyContactAttempt({
      id: "1",
      channel: EngagementChannel.EMAIL,
      status,
      createdAt: new Date("2026-01-01"),
      attemptedAt: null,
      result: null,
    });
    expect(event.presentation).toBe("workflow");
    expect(event.accessibilityLabel).toContain("Unsent");
  });

  it.each([
    SellerContactAttemptStatus.DELIVERED,
    SellerContactAttemptStatus.MANUALLY_RECORDED,
  ])("renders %s as outbound only with actual attempt time", (status) => {
    const attemptedAt = new Date("2026-01-02");
    expect(
      classifyContactAttempt({
        id: "1",
        channel: EngagementChannel.SMS,
        status,
        createdAt: new Date("2026-01-01"),
        attemptedAt,
        result: null,
      }),
    ).toMatchObject({ presentation: "outbound", at: attemptedAt });
  });

  it("paginates equal timestamps without duplicates or omissions", () => {
    const at = new Date("2026-01-01");
    const events = Array.from({ length: 45 }, (_, index) => ({
      id: `event-${String(index).padStart(2, "0")}`,
      at,
      type: "Note",
      body: "x",
      status: "Recorded",
      presentation: "system" as const,
      accessibilityLabel: "System event",
    }));
    const pages = [0, 1, 2].flatMap((page) =>
      paginateTimeline(events, page).events.map((event) => event.id),
    );
    expect(new Set(pages).size).toBe(45);
    expect(pages).toHaveLength(45);
  });
});
