import {
  evaluateAgentTask,
  type AgentRole,
  type AgentTaskType,
  type TransactionControl,
  type WorkflowPolicyDecision,
} from "@/lib/agent-workflow-policy";

export type AgentWorkflowTask = {
  id: string;
  role: AgentRole;
  taskType: AgentTaskType;
  transactionId?: string;
  transactionControl?: TransactionControl;
  ownerApproved?: boolean;
  evidenceComplete?: boolean;
  operatingMode?: "SUPERVISED" | "AUTONOMOUS";
  autonomyEvidence?: {
    jurisdictionConfigured: boolean;
    counselApproved: boolean;
    complianceEvidenceVerified: boolean;
    provenComplianceRecord: boolean;
  };
};

export type AgentWorkflowResult = {
  taskId: string;
  status: "READY" | "HANDOFF_REQUIRED" | "WAITING_FOR_OWNER" | "BLOCKED";
  assignedRole: AgentRole;
  reasons: string[];
  permittedOutput: "INTERNAL_WORK_PRODUCT" | "NONE";
};

const statusByOutcome: Readonly<Record<WorkflowPolicyDecision["outcome"], AgentWorkflowResult["status"]>> = {
  PROCESS: "READY",
  HANDOFF: "HANDOFF_REQUIRED",
  OWNER_APPROVAL_REQUIRED: "WAITING_FOR_OWNER",
  BLOCKED: "BLOCKED",
};

/**
 * Produces a deterministic execution plan. It does not perform network calls,
 * contact a person, alter a transaction, sign a contract, or make a legal conclusion.
 */
export function planAgentWorkflow(task: AgentWorkflowTask): AgentWorkflowResult {
  const decision = evaluateAgentTask(task);
  return {
    taskId: task.id,
    status: statusByOutcome[decision.outcome],
    assignedRole: decision.assignedRole,
    reasons: decision.reasons,
    permittedOutput: decision.allowed ? "INTERNAL_WORK_PRODUCT" : "NONE",
  };
}

export function planAgentWorkflowBatch(tasks: readonly AgentWorkflowTask[]) {
  return tasks.map(planAgentWorkflow);
}
