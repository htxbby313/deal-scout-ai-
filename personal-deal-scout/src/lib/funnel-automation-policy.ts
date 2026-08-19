import type { AcquisitionStageName } from "@/lib/acquisition-funnel";

export type FunnelExpiryPolicy = { stage: AcquisitionStageName; reviewIntervalHours: number; expiryAction: "REFRESH_RESEARCH" | "MANUAL_VERIFICATION" | "NURTURE" | "DISQUALIFY" | "ARCHIVE"; requiredGateTypes: readonly string[] };
export function nextReviewAt(enteredAt: Date, intervalHours: number) { if (!Number.isInteger(intervalHours) || intervalHours < 1) throw new Error("Review interval must be a positive whole number of hours."); return new Date(enteredAt.getTime() + intervalHours * 3_600_000); }
export function evaluateFunnelExpiration(input: { stage: AcquisitionStageName; stageHistoryId: string; controlStatus?: "ACTIVE" | "ON_HOLD" | "STOPPED" | null; nextReviewAt?: Date | null; openBlockers: readonly string[]; missingOrStaleGates: readonly string[]; policy: FunnelExpiryPolicy | null; now: Date }) {
  const reasons: string[] = [];
  if (!input.policy || input.policy.stage !== input.stage) reasons.push("active_stage_policy_missing");
  if (!input.nextReviewAt || input.nextReviewAt > input.now) reasons.push("not_expired");
  if (input.controlStatus === "STOPPED") reasons.push("transaction_stopped");
  if (!input.stageHistoryId) reasons.push("stage_history_missing");
  if (reasons.length) return { due: false, action: null, targetStage: null, reasons };
  const action = input.missingOrStaleGates.length ? "REFRESH_RESEARCH" : input.openBlockers.length ? "MANUAL_VERIFICATION" : input.policy!.expiryAction;
  const targetStage = action === "NURTURE" ? "NURTURE" : action === "DISQUALIFY" ? "DISQUALIFIED" : action === "ARCHIVE" ? "ARCHIVED" : null;
  return { due: true, action, targetStage, reasons: [...input.missingOrStaleGates.map((gate) => `stale_gate:${gate}`), ...input.openBlockers.map((blocker) => `open_blocker:${blocker}`)] };
}

export function classifyFunnelQueue(input: { nextReviewAt?: Date | null; openBlockers: number; projectedBaseCents?: bigint | null; highValueThresholdCents?: bigint | null; lastActivityAt: Date; now: Date }) {
  const queues: string[] = [];
  if (input.openBlockers) queues.push("BLOCKED");
  if (input.nextReviewAt && input.nextReviewAt <= input.now) queues.push("EXPIRED"); else if (input.nextReviewAt && input.nextReviewAt.getTime() - input.now.getTime() <= 24 * 3_600_000) queues.push("EXPIRING");
  if (input.now.getTime() - input.lastActivityAt.getTime() >= 7 * 86_400_000) queues.push("STALLED");
  if (input.projectedBaseCents != null && input.highValueThresholdCents != null && input.projectedBaseCents >= input.highValueThresholdCents) queues.push("HIGH_VALUE");
  return queues;
}
