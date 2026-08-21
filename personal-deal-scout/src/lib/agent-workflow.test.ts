import { describe, expect, it } from "vitest";

import { planAgentWorkflow, planAgentWorkflowBatch } from "@/lib/agent-workflow";
import { canHandoff, evaluateAgentTask, evaluateAutonomyEligibility, evaluateSupervisedTrackRecord } from "@/lib/agent-workflow-policy";

const provenAutonomy = {
  jurisdictionConfigured: true,
  counselApproved: true,
  complianceEvidenceVerified: true,
  provenComplianceRecord: true,
};

describe("agent workflow policy", () => {
  it("requires a proven supervised track record before complete autonomy", () => {
    expect(evaluateSupervisedTrackRecord(Array(29).fill("COMPLETED"))).toMatchObject({ eligible: false, blockers: ["1 more supervised tasks"] });
    expect(evaluateSupervisedTrackRecord(["FAILED", ...Array(29).fill("COMPLETED")])).toMatchObject({ eligible: false });
    expect(evaluateSupervisedTrackRecord(Array(30).fill("COMPLETED"))).toEqual({ eligible: true, blockers: [] });
  });
  it("routes each task to its single accountable agent", () => {
    expect(planAgentWorkflow({ id: "1", role: "OPERATIONS_COORDINATOR", taskType: "RESEARCH_PROPERTY" })).toEqual({
      taskId: "1",
      status: "HANDOFF_REQUIRED",
      assignedRole: "RESEARCH",
      reasons: ["RESEARCH_PROPERTY is assigned to the RESEARCH agent."],
      permittedOutput: "NONE",
    });
  });

  it("allows bounded internal work by the assigned agent", () => {
    const result = planAgentWorkflow({
      id: "2",
      role: "BUYER_DEVELOPER",
      taskType: "MATCH_BUYER",
      operatingMode: "AUTONOMOUS",
      autonomyEvidence: provenAutonomy,
      evidenceComplete: true,
    });
    expect(result.status).toBe("READY");
    expect(result.permittedOutput).toBe("INTERNAL_WORK_PRODUCT");
  });

  it("blocks every agent task on a stopped transaction", () => {
    const roles = ["OPERATIONS_COORDINATOR", "RESEARCH", "SELLER_ACQUISITION", "BUYER_DEVELOPER", "TRANSACTION_COMPLIANCE"] as const;
    const results = planAgentWorkflowBatch(roles.map((role) => ({
      id: role,
      role,
      taskType: role === "RESEARCH" ? "RESEARCH_PROPERTY" as const : "COORDINATE_PIPELINE" as const,
      transactionControl: "STOPPED" as const,
    })));
    expect(results.every((result) => result.status === "BLOCKED")).toBe(true);
    expect(results.every((result) => result.permittedOutput === "NONE")).toBe(true);
  });

  it("requires owner approval before sensitive drafts", () => {
    const result = evaluateAgentTask({ role: "SELLER_ACQUISITION", taskType: "DRAFT_OFFER" });
    expect(result.outcome).toBe("OWNER_APPROVAL_REQUIRED");
    expect(result.allowed).toBe(false);
  });

  it("defaults every agent to supervised owner approval", () => {
    const result = evaluateAgentTask({ role: "RESEARCH", taskType: "RESEARCH_PROPERTY" });
    expect(result.outcome).toBe("OWNER_APPROVAL_REQUIRED");
    expect(result.reasons).toContain("Supervised mode requires explicit owner approval.");
  });

  it("unlocks autonomous internal work only after every eligibility gate is proven", () => {
    expect(evaluateAutonomyEligibility(provenAutonomy)).toEqual({ eligible: true, reasons: [] });
    const locked = evaluateAgentTask({
      role: "RESEARCH",
      taskType: "RESEARCH_PROPERTY",
      operatingMode: "AUTONOMOUS",
      autonomyEvidence: { ...provenAutonomy, counselApproved: false },
    });
    expect(locked.outcome).toBe("OWNER_APPROVAL_REQUIRED");
    expect(locked.reasons).toContain("Autonomous operation is locked.");
  });

  it("keeps sensitive drafts owner-gated in eligible autonomous mode", () => {
    const result = evaluateAgentTask({
      role: "BUYER_DEVELOPER",
      taskType: "DRAFT_BUYER_OUTREACH",
      operatingMode: "AUTONOMOUS",
      autonomyEvidence: provenAutonomy,
    });
    expect(result.outcome).toBe("OWNER_APPROVAL_REQUIRED");
  });

  it("fails compliance review closed when evidence is incomplete", () => {
    const result = evaluateAgentTask({
      role: "TRANSACTION_COMPLIANCE",
      taskType: "REVIEW_COMPLIANCE_EVIDENCE",
      evidenceComplete: false,
      ownerApproved: true,
    });
    expect(result.outcome).toBe("BLOCKED");
    expect(result.reasons[0]).toContain("fails closed");
  });

  it.each([
    "SEND_OUTBOUND_MESSAGE",
    "ISSUE_LEGAL_CONCLUSION",
    "EXECUTE_CONTRACT",
    "MOVE_FUNDS",
    "ISSUE_CLOSING_INSTRUCTION",
  ] as const)("prohibits autonomous %s", (taskType) => {
    const result = evaluateAgentTask({ role: taskType === "ISSUE_LEGAL_CONCLUSION" || taskType === "ISSUE_CLOSING_INSTRUCTION" ? "TRANSACTION_COMPLIANCE" : "OPERATIONS_COORDINATOR", taskType, ownerApproved: true });
    expect(result.outcome).toBe("BLOCKED");
    expect(result.allowed).toBe(false);
  });

  it("allows only explicit role handoff paths", () => {
    expect(canHandoff("SELLER_ACQUISITION", "TRANSACTION_COMPLIANCE")).toBe(true);
    expect(canHandoff("SELLER_ACQUISITION", "BUYER_DEVELOPER")).toBe(false);
  });
});
