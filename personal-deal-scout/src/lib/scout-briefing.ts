import type { OwnerQueueItem } from "@/lib/funnel-owner-queue";

export type ScoutBriefing = {
  headline: string;
  lines: string[];
};

export function scoutBriefing(items: readonly OwnerQueueItem[]): ScoutBriefing {
  if (!items.length) {
    return {
      headline: "Scout is watching. Nothing needs you right now.",
      lines: [],
    };
  }
  const count = (kind: OwnerQueueItem["kind"]) =>
    items.filter((item) => item.kind === kind).length;
  const buyBox = items.filter(
    (item) =>
      item.kind === "FUNNEL_BLOCKER" && item.label.startsWith("Buy Box match"),
  ).length;
  const otherBlockers = count("FUNNEL_BLOCKER") - buyBox;
  const lines = [
    buyBox
      ? `${buyBox} new ${buyBox === 1 ? "property matches" : "properties match"} your Buy Box.`
      : null,
    count("SELLER_ENGAGEMENT")
      ? `${count("SELLER_ENGAGEMENT")} seller ${count("SELLER_ENGAGEMENT") === 1 ? "thread needs" : "threads need"} a decision.`
      : null,
    count("DEVELOPER_DRAFT")
      ? `${count("DEVELOPER_DRAFT")} buyer ${count("DEVELOPER_DRAFT") === 1 ? "draft is" : "drafts are"} ready — not sent.`
      : null,
    count("TRANSACTION_APPROVAL")
      ? `${count("TRANSACTION_APPROVAL")} deal ${count("TRANSACTION_APPROVAL") === 1 ? "approval is" : "approvals are"} waiting.`
      : null,
    otherBlockers
      ? `${otherBlockers} deal ${otherBlockers === 1 ? "needs" : "deals need"} attention.`
      : null,
    count("AGENT_TASK")
      ? `${count("AGENT_TASK")} agent ${count("AGENT_TASK") === 1 ? "recommendation is" : "recommendations are"} waiting.`
      : null,
    count("CONTRACT_TEMPLATE")
      ? `${count("CONTRACT_TEMPLATE")} contract ${count("CONTRACT_TEMPLATE") === 1 ? "template needs" : "templates need"} review.`
      : null,
  ].filter((line): line is string => Boolean(line));
  return {
    headline: `Scout: ${items[0].label}.`,
    lines,
  };
}
