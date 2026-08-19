import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { evaluateStageTransition } from "./acquisition-funnel";
import { evaluateAgentTask } from "./agent-workflow-policy";
import { routeBuyerQualificationEvidence, routeSellerFitEvidence } from "./evidence-routing";
import { calculateFinancialProjection, calculateSettlementReviewedProfit } from "./financial-truth";
import { researchRetryDecision } from "./research-automation-policy";
import { evaluateContactAttempt, evaluateOfferStatus } from "./seller-crm-policy";
import { evaluateTransactionGate } from "./transaction-policy";

const now = new Date("2026-08-19T20:00:00Z");

describe("research to funnel to CRM to financial truth boundaries", () => {
  it("keeps missing research evidence out of seller and buyer workflow", () => {
    expect(routeSellerFitEvidence([], now.toISOString()).status).toBe("NEEDS_MANUAL_VERIFICATION");
    expect(routeBuyerQualificationEvidence([], now.toISOString()).status).toBe("NEEDS_MANUAL_VERIFICATION");
    expect(evaluateStageTransition({ currentStage: "DISCOVERED", nextStage: "RESEARCHABLE", gates: [{ type: "PROPERTY_EVIDENCE", status: "PENDING" }], transactionControlStatus: "ACTIVE", now })).toMatchObject({ allowed: false, blockers: ["gate_property_evidence_not_satisfied"] });
  });

  it.each(["ON_HOLD", "STOPPED"] as const)("blocks funnel, CRM delivery, and transaction progression when owner control is %s", (controlStatus) => {
    expect(evaluateStageTransition({ currentStage: "RESEARCHABLE", nextStage: "BUYER_FIT", gates: [{ type: "BUYER_COVERAGE", status: "SATISFIED" }], transactionControlStatus: controlStatus, now }).allowed).toBe(false);
    expect(evaluateContactAttempt({ suppressed: false, consentGranted: true, policyActive: true, insidePermittedWindow: true, ownerApproved: true, providerReady: true, transactionControlStatus: controlStatus }).canDeliver).toBe(false);
    expect(evaluateTransactionGate({ controlStatus, nextStatus: "OFFER_PENDING", counselApprovedAt: now, complianceVerifiedAt: now, approvals: [{ type: "OFFER", status: "APPROVED" }], now }).allowed).toBe(false);
  });

  it("makes STOP absolute for internal agent work too", () => {
    expect(evaluateAgentTask({ role: "RESEARCH", taskType: "RESEARCH_PROPERTY", transactionControl: "STOPPED", ownerApproved: true, evidenceComplete: true })).toMatchObject({ allowed: false, outcome: "BLOCKED" });
  });

  it("does not turn projections into realized profit or allow completion directly", () => {
    const projected = calculateFinancialProjection({ sellerContractPriceCents: BigInt(20_000_000), buyerPriceLowCents: BigInt(22_000_000), buyerPriceBaseCents: BigInt(23_000_000), buyerPriceHighCents: BigInt(24_000_000), transactionCostsCents: BigInt(200_000), concessionsCents: BigInt(100_000), riskReserveCents: BigInt(300_000), earnestMoneyAtRiskCents: BigInt(100_000), probabilityLowBps: 5000, probabilityBaseBps: 3000, probabilityHighBps: 2000 });
    expect(projected).toMatchObject({ kind: "PROJECTED", guaranteed: false });
    expect(evaluateOfferStatus({ requestedStatus: "OWNER_APPROVED", ownerApprovedAt: now, ownerApprovedBy: "owner", transactionActive: true, financialProjectionId: "projection-1", documentVersionId: "document-1", now }).allowed).toBe(true);
    expect(evaluateTransactionGate({ controlStatus: "ACTIVE", nextStatus: "COMPLETED", counselApprovedAt: now, complianceVerifiedAt: now, approvals: [], now })).toMatchObject({ allowed: false, reasons: expect.arrayContaining(["Completion must be recorded through the verified closing workflow."]) });
    expect(() => calculateSettlementReviewedProfit({ grossAssignmentFeeCents: projected.feeBaseCents, actualExpensesCents: BigInt(0), settlementDocumentUrl: "", settlementDocumentHash: "", reviewedBy: "", reviewedAt: "" })).toThrow();
  });
});

describe("idempotency, concurrency, and migration safety contracts", () => {
  it("returns the same retry decision for the same clock and attempt", () => {
    const input = { attemptCount: 2, failedAt: new Date("2026-08-19T19:00:00Z"), now };
    expect(researchRetryDecision(input)).toEqual(researchRetryDecision(input));
  });

  it("uses additive financial tables and database uniqueness for concurrent versions", () => {
    const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260819213000_financial_truth_foundation/migration.sql"), "utf8");
    expect(migration).toContain('CREATE TABLE "FinancialProjection"');
    expect(migration).toContain('CREATE TABLE "SettlementReview"');
    expect(migration).toContain('CREATE UNIQUE INDEX "FinancialProjection_transactionId_version_key"');
    expect(migration).toContain('CREATE UNIQUE INDEX "SettlementReview_transactionId_version_key"');
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN|TYPE|SCHEMA)\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("adds agent-task deduplication without removing historical work", () => {
    const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260819243000_agent_task_dedup/migration.sql"), "utf8");
    expect(migration).toContain('CREATE UNIQUE INDEX "AgentTask_dedupeKey_key"');
    expect(migration).toContain('UPDATE "AgentTask" SET "dedupeKey" = "id"');
    expect(migration).not.toMatch(/\b(DROP|TRUNCATE|DELETE)\b/i);
  });
});
