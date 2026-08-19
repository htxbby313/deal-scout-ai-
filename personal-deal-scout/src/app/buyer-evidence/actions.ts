"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import {
  activateBuyerReliabilityConfiguration,
  createBuyerReliabilityConfiguration,
  persistDerivedBuyerReliabilityScore,
  recordBuyerCapacity,
  recordBuyerPerformanceIssue,
  recordBuyerPermission,
  recordBuyerReliabilityEvidence,
} from "@/lib/buyer-demand-service";
const text = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const date = (d: FormData, k: string) => new Date(text(d, k));
const num = (d: FormData, k: string) => Number(text(d, k));
const done = () => revalidatePath("/buyer-evidence");
export async function recordCapacityAction(d: FormData) {
  await requireOwner();
  await recordBuyerCapacity({
    developerId: text(d, "developerId"),
    amountCents: text(d, "amount")
      ? BigInt(Math.round(num(d, "amount") * 100))
      : undefined,
    sourceUrl: text(d, "sourceUrl"),
    artifactHash: text(d, "artifactHash") || undefined,
    observedAt: date(d, "observedAt"),
    expiresAt: date(d, "expiresAt"),
    reviewer: "owner",
    verified: text(d, "verified") === "on",
  });
  done();
}
export async function recordReliabilityEvidenceAction(d: FormData) {
  await requireOwner();
  await recordBuyerReliabilityEvidence({
    developerId: text(d, "developerId"),
    completedClosings: num(d, "completedClosings"),
    failedClosings: num(d, "failedClosings"),
    retrades: num(d, "retrades"),
    responsesMeasured: num(d, "responsesMeasured"),
    averageResponseHours: text(d, "averageResponseHours")
      ? num(d, "averageResponseHours")
      : undefined,
    unresolvedIssues: num(d, "unresolvedIssues"),
    averageCloseDays: text(d, "averageCloseDays")
      ? num(d, "averageCloseDays")
      : undefined,
    sourceUrl: text(d, "sourceUrl"),
    expiresAt: date(d, "expiresAt"),
    reviewer: "owner",
    verified: text(d, "verified") === "on",
  });
  done();
}
export async function recordPermissionAction(d: FormData) {
  await requireOwner();
  await recordBuyerPermission({
    developerId: text(d, "developerId"),
    channel: text(d, "channel") as
      "EMAIL" | "SMS" | "PHONE" | "MAIL" | "INTERNAL",
    status: text(d, "status") as
      "UNKNOWN" | "GRANTED" | "DENIED" | "REVOKED" | "EXPIRED",
    sourceUrl: text(d, "sourceUrl") || undefined,
    capturedAt: date(d, "capturedAt"),
    expiresAt: text(d, "expiresAt") ? date(d, "expiresAt") : undefined,
    reviewer: "owner",
  });
  done();
}
export async function recordIssueAction(d: FormData) {
  await requireOwner();
  await recordBuyerPerformanceIssue({
    developerId: text(d, "developerId"),
    type: text(d, "type"),
    status: text(d, "status") as "OPEN" | "DISPUTED" | "RESOLVED" | "DISMISSED",
    occurredAt: date(d, "occurredAt"),
    description: text(d, "description"),
    sourceUrl: text(d, "sourceUrl"),
    resolution: text(d, "resolution") || undefined,
    resolvedAt: text(d, "resolvedAt") ? date(d, "resolvedAt") : undefined,
    reviewer: "owner",
  });
  done();
}
export async function createReliabilityConfigAction(d: FormData) {
  await requireOwner();
  await createBuyerReliabilityConfiguration({
    weights: {
      financialCapacity: num(d, "financialCapacity"),
      marketActivity: num(d, "marketActivity"),
      criteriaSpecificity: num(d, "criteriaSpecificity"),
      responseTime: num(d, "responseTime"),
      closingRate: num(d, "closingRate"),
      pofFreshness: num(d, "pofFreshness"),
      retradePenalty: num(d, "retradePenalty"),
      failedClosingPenalty: num(d, "failedClosingPenalty"),
      unresolvedIssuePenalty: num(d, "unresolvedIssuePenalty"),
    },
    reason: text(d, "reason"),
    actor: "owner",
    effectiveAt: date(d, "effectiveAt"),
    expiresAt: text(d, "expiresAt") ? date(d, "expiresAt") : undefined,
  });
  done();
}
export async function activateReliabilityConfigAction(d: FormData) {
  await requireOwner();
  await activateBuyerReliabilityConfiguration({
    configurationId: text(d, "configurationId"),
    actor: "owner",
  });
  done();
}
export async function calculateReliabilityAction(d: FormData) {
  await requireOwner();
  await persistDerivedBuyerReliabilityScore({
    developerId: text(d, "developerId"),
    demandVersionId: text(d, "demandVersionId"),
    reliabilityEvidenceId: text(d, "reliabilityEvidenceId"),
    configurationId: text(d, "configurationId"),
    actor: "owner",
    expiresAt: date(d, "expiresAt"),
  });
  done();
}
