import {
  EngagementChannel,
  SellerDispositionReason,
  SellerEngagementStatus,
  SellerFollowUpStatus,
  SellerContactAttemptStatus,
  SellerAuthorityStatus,
  SellerRepresentationStatus,
} from "@prisma/client";

export const engagementChannels = Object.values(EngagementChannel);
export const sellerDispositionReasons = Object.values(SellerDispositionReason);
export const sellerAuthorityStatuses = Object.values(SellerAuthorityStatus);
export const sellerRepresentationStatuses = Object.values(
  SellerRepresentationStatus,
);
export const terminalSellerEngagementStatuses = new Set<SellerEngagementStatus>(
  [SellerEngagementStatus.COMPLETED, SellerEngagementStatus.CANCELLED],
);
export const actionableFollowUpStatuses = new Set<SellerFollowUpStatus>([
  SellerFollowUpStatus.DUE,
  SellerFollowUpStatus.SCHEDULED,
]);
export const unsentAttemptStatuses = new Set<SellerContactAttemptStatus>([
  SellerContactAttemptStatus.DRAFT,
  SellerContactAttemptStatus.APPROVED_NOT_SENT,
]);
export const communicatedAttemptStatuses = new Set<SellerContactAttemptStatus>([
  SellerContactAttemptStatus.MANUALLY_RECORDED,
  SellerContactAttemptStatus.DELIVERED,
  SellerContactAttemptStatus.FAILED,
]);

export function parseEnumValue<T extends string>(
  raw: string,
  values: readonly T[],
  field: string,
): T {
  if (!values.includes(raw as T)) throw new Error(`${field} is invalid.`);
  return raw as T;
}

export function parseLines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isEngagementVisibleInView(
  status: SellerEngagementStatus,
  view?: string,
) {
  const normalized = view || "open";
  if (normalized === "open")
    return !terminalSellerEngagementStatuses.has(status);
  if (normalized === "completed")
    return status === SellerEngagementStatus.COMPLETED;
  if (normalized === "cancelled")
    return status === SellerEngagementStatus.CANCELLED;
  return (
    normalized === "all" ||
    normalized === "follow-up" ||
    normalized === "offers" ||
    normalized === "contract"
  );
}

export function selectVisibleEngagement<T extends { id: string }>(
  visible: readonly T[],
  selectedId?: string,
) {
  if (selectedId) {
    return visible.find((item) => item.id === selectedId) ?? null;
  }
  return visible[0] ?? null;
}

export function firstActionableFollowUp<
  T extends { status: SellerFollowUpStatus; dueAt: Date },
>(rows: readonly T[]) {
  return (
    rows
      .filter((row) => actionableFollowUpStatuses.has(row.status))
      .sort((a, b) => {
        const priority = (status: SellerFollowUpStatus) =>
          status === SellerFollowUpStatus.DUE ? 0 : 1;
        return (
          priority(a.status) - priority(b.status) ||
          a.dueAt.getTime() - b.dueAt.getTime()
        );
      })[0] ?? null
  );
}

export function sellerNextAction(input: {
  controlStatus: string;
  consentStatus?: string;
  conversationCount: number;
  sellerFactCount: number;
  engagementStatus: string;
  followUps: readonly {
    status: SellerFollowUpStatus;
    dueAt: Date;
    reason: string;
  }[];
  latestOfferStatus?: string;
}) {
  if (input.controlStatus === "STOPPED")
    return [
      "Transaction stopped",
      "No contact or transaction work can continue.",
      "red",
    ] as const;
  if (input.consentStatus === "DENIED" || input.consentStatus === "REVOKED")
    return [
      "Do not contact",
      "Consent is denied or revoked. All future contact stays suppressed.",
      "red",
    ] as const;
  if (!input.conversationCount)
    return [
      "Record the first conversation",
      "Add a sourced call, email, meeting, or seller reply to this deal timeline.",
      "blue",
    ] as const;
  if (!input.sellerFactCount)
    return [
      "Complete property intake",
      "Capture authority, condition, motivation, timeline, and seller expectations from the sourced conversation.",
      "blue",
      "#seller-intake",
    ] as const;
  if (input.engagementStatus === "READY_FOR_OWNER_REVIEW")
    return [
      "Review before contact",
      "Confirm consent, state policy, transaction control, message content, and owner approval.",
      "amber",
    ] as const;
  const followUp = firstActionableFollowUp(input.followUps);
  if (followUp)
    return [
      "Complete the next follow-up",
      `${followUp.reason} · ${followUp.dueAt.toLocaleString()}`,
      "blue",
    ] as const;
  if (input.latestOfferStatus === "DRAFT")
    return [
      "Review the offer",
      "Check the supported range and underwriting before owner approval.",
      "amber",
    ] as const;
  return [
    "Schedule the next follow-up",
    "No due or scheduled follow-up is active for this seller.",
    "blue",
    "#follow-up-tools",
  ] as const;
}

export type SellerTimelineEvent = {
  id: string;
  at: Date;
  type: string;
  body: string;
  status: string;
  presentation: "inbound" | "outbound" | "workflow" | "system";
  accessibilityLabel: string;
};

export function classifyContactAttempt(input: {
  id: string;
  channel: EngagementChannel;
  status: SellerContactAttemptStatus;
  createdAt: Date;
  attemptedAt: Date | null;
  result: string | null;
}): SellerTimelineEvent {
  if (unsentAttemptStatuses.has(input.status)) {
    return {
      id: `attempt-${input.id}`,
      at: input.createdAt,
      type: "Workflow",
      body:
        input.status === SellerContactAttemptStatus.DRAFT
          ? `${humanize(input.channel)} drafted.`
          : "Contact attempt approved, not sent.",
      status: humanize(input.status),
      presentation: "workflow",
      accessibilityLabel: "Unsent workflow event",
    };
  }
  const provenCommunication =
    communicatedAttemptStatuses.has(input.status) && input.attemptedAt != null;
  return {
    id: `attempt-${input.id}`,
    at: input.attemptedAt ?? input.createdAt,
    type: provenCommunication ? humanize(input.channel) : "Workflow",
    body:
      input.result ??
      (provenCommunication
        ? "Contact attempt recorded."
        : `Contact workflow ${humanize(input.status).toLowerCase()}.`),
    status: humanize(input.status),
    presentation: provenCommunication ? "outbound" : "workflow",
    accessibilityLabel: provenCommunication
      ? "Outbound communication"
      : "Workflow event without verified contact",
  };
}

export function paginateTimeline(
  events: readonly SellerTimelineEvent[],
  page: number,
  pageSize = 20,
) {
  const ordered = [...events].sort(
    (a, b) => b.at.getTime() - a.at.getTime() || b.id.localeCompare(a.id),
  );
  const start = Math.max(0, page) * pageSize;
  return {
    events: ordered.slice(start, start + pageSize),
    hasEarlier: ordered.length > start + pageSize,
  };
}

export function paginateTimelineThroughPage(
  events: readonly SellerTimelineEvent[],
  page: number,
  pageSize = 20,
) {
  const ordered = [...events].sort(
    (a, b) => b.at.getTime() - a.at.getTime() || b.id.localeCompare(a.id),
  );
  const end = (Math.max(0, page) + 1) * pageSize;
  return { events: ordered.slice(0, end), hasEarlier: ordered.length > end };
}

export function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
