export const AGENT_ROLES = [
  "OPERATIONS_COORDINATOR",
  "RESEARCH",
  "SELLER_ACQUISITION",
  "BUYER_DEVELOPER",
  "TRANSACTION_COMPLIANCE",
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export const AGENT_TASK_TYPES = [
  "COORDINATE_PIPELINE",
  "RESEARCH_PROPERTY",
  "RESEARCH_DEVELOPER",
  "VERIFY_PUBLIC_SOURCE",
  "ASSESS_SELLER_FIT",
  "DRAFT_SELLER_OUTREACH",
  "DRAFT_OFFER",
  "MATCH_BUYER",
  "QUALIFY_BUYER",
  "DRAFT_BUYER_OUTREACH",
  "REVIEW_COMPLIANCE_EVIDENCE",
  "PREPARE_DOCUMENT_CHECKLIST",
  "REQUEST_OWNER_APPROVAL",
  "SEND_OUTBOUND_MESSAGE",
  "ISSUE_LEGAL_CONCLUSION",
  "EXECUTE_CONTRACT",
  "MOVE_FUNDS",
  "ISSUE_CLOSING_INSTRUCTION",
] as const;

export type AgentTaskType = (typeof AGENT_TASK_TYPES)[number];
export type TransactionControl = "ACTIVE" | "ON_HOLD" | "STOPPED";

export const taskOwner: Readonly<Record<AgentTaskType, AgentRole>> = {
  COORDINATE_PIPELINE: "OPERATIONS_COORDINATOR",
  RESEARCH_PROPERTY: "RESEARCH",
  RESEARCH_DEVELOPER: "RESEARCH",
  VERIFY_PUBLIC_SOURCE: "RESEARCH",
  ASSESS_SELLER_FIT: "SELLER_ACQUISITION",
  DRAFT_SELLER_OUTREACH: "SELLER_ACQUISITION",
  DRAFT_OFFER: "SELLER_ACQUISITION",
  MATCH_BUYER: "BUYER_DEVELOPER",
  QUALIFY_BUYER: "BUYER_DEVELOPER",
  DRAFT_BUYER_OUTREACH: "BUYER_DEVELOPER",
  REVIEW_COMPLIANCE_EVIDENCE: "TRANSACTION_COMPLIANCE",
  PREPARE_DOCUMENT_CHECKLIST: "TRANSACTION_COMPLIANCE",
  REQUEST_OWNER_APPROVAL: "OPERATIONS_COORDINATOR",
  SEND_OUTBOUND_MESSAGE: "OPERATIONS_COORDINATOR",
  ISSUE_LEGAL_CONCLUSION: "TRANSACTION_COMPLIANCE",
  EXECUTE_CONTRACT: "OPERATIONS_COORDINATOR",
  MOVE_FUNDS: "OPERATIONS_COORDINATOR",
  ISSUE_CLOSING_INSTRUCTION: "TRANSACTION_COMPLIANCE",
};

const permanentlyProhibitedTasks = new Set<AgentTaskType>([
  "SEND_OUTBOUND_MESSAGE",
  "ISSUE_LEGAL_CONCLUSION",
  "EXECUTE_CONTRACT",
  "MOVE_FUNDS",
  "ISSUE_CLOSING_INSTRUCTION",
]);

const ownerApprovalGatedTasks = new Set<AgentTaskType>([
  "DRAFT_SELLER_OUTREACH",
  "DRAFT_OFFER",
  "DRAFT_BUYER_OUTREACH",
  "REQUEST_OWNER_APPROVAL",
]);

const evidenceGatedTasks = new Set<AgentTaskType>([
  "ASSESS_SELLER_FIT",
  "DRAFT_SELLER_OUTREACH",
  "DRAFT_OFFER",
  "MATCH_BUYER",
  "QUALIFY_BUYER",
  "DRAFT_BUYER_OUTREACH",
  "REVIEW_COMPLIANCE_EVIDENCE",
]);

const allowedHandoffs: Readonly<Record<AgentRole, readonly AgentRole[]>> = {
  OPERATIONS_COORDINATOR: ["RESEARCH", "SELLER_ACQUISITION", "BUYER_DEVELOPER", "TRANSACTION_COMPLIANCE"],
  RESEARCH: ["OPERATIONS_COORDINATOR", "SELLER_ACQUISITION", "BUYER_DEVELOPER", "TRANSACTION_COMPLIANCE"],
  SELLER_ACQUISITION: ["OPERATIONS_COORDINATOR", "RESEARCH", "TRANSACTION_COMPLIANCE"],
  BUYER_DEVELOPER: ["OPERATIONS_COORDINATOR", "RESEARCH", "TRANSACTION_COMPLIANCE"],
  TRANSACTION_COMPLIANCE: ["OPERATIONS_COORDINATOR", "RESEARCH", "SELLER_ACQUISITION", "BUYER_DEVELOPER"],
};

export type WorkflowPolicyInput = {
  role: AgentRole;
  taskType: AgentTaskType;
  transactionControl?: TransactionControl;
  ownerApproved?: boolean;
  evidenceComplete?: boolean;
  operatingMode?: "SUPERVISED" | "AUTONOMOUS";
  autonomyEvidence?: AutonomyEvidence;
};

export type AutonomyEvidence = {
  jurisdictionConfigured: boolean;
  counselApproved: boolean;
  complianceEvidenceVerified: boolean;
  provenComplianceRecord: boolean;
};

export type WorkflowPolicyDecision = {
  allowed: boolean;
  outcome: "PROCESS" | "HANDOFF" | "OWNER_APPROVAL_REQUIRED" | "BLOCKED";
  assignedRole: AgentRole;
  reasons: string[];
};

export function canHandoff(from: AgentRole, to: AgentRole) {
  return allowedHandoffs[from].includes(to);
}

export function evaluateAutonomyEligibility(evidence?: AutonomyEvidence) {
  const reasons: string[] = [];
  if (!evidence?.jurisdictionConfigured) reasons.push("The transaction jurisdiction is not configured.");
  if (!evidence?.counselApproved) reasons.push("Counsel approval for this jurisdiction is not recorded.");
  if (!evidence?.complianceEvidenceVerified) reasons.push("Compliance evidence is not verified.");
  if (!evidence?.provenComplianceRecord) reasons.push("A proven compliant operating record is not documented.");
  return { eligible: reasons.length === 0, reasons };
}

export function evaluateAgentTask(input: WorkflowPolicyInput): WorkflowPolicyDecision {
  const assignedRole = taskOwner[input.taskType];

  if (input.transactionControl === "STOPPED") {
    return {
      allowed: false,
      outcome: "BLOCKED",
      assignedRole,
      reasons: ["The transaction is STOPPED. No agent work or handoff is permitted."],
    };
  }

  if (permanentlyProhibitedTasks.has(input.taskType)) {
    return {
      allowed: false,
      outcome: "BLOCKED",
      assignedRole,
      reasons: ["Agents cannot send messages, make legal conclusions, execute contracts, move funds, or issue closing instructions."],
    };
  }

  if (input.role !== assignedRole) {
    return {
      allowed: false,
      outcome: canHandoff(input.role, assignedRole) ? "HANDOFF" : "BLOCKED",
      assignedRole,
      reasons: [`${input.taskType} is assigned to the ${assignedRole} agent.`],
    };
  }

  const operatingMode = input.operatingMode ?? "SUPERVISED";
  if (operatingMode === "AUTONOMOUS") {
    const autonomy = evaluateAutonomyEligibility(input.autonomyEvidence);
    if (!autonomy.eligible) {
      return {
        allowed: false,
        outcome: "OWNER_APPROVAL_REQUIRED",
        assignedRole,
        reasons: ["Autonomous operation is locked.", ...autonomy.reasons],
      };
    }
  } else if (!input.ownerApproved) {
    return {
      allowed: false,
      outcome: "OWNER_APPROVAL_REQUIRED",
      assignedRole,
      reasons: ["Supervised mode requires explicit owner approval."],
    };
  }

  // These tasks remain owner-gated even after autonomous internal work is unlocked.
  if (ownerApprovalGatedTasks.has(input.taskType) && !input.ownerApproved) {
    return {
      allowed: false,
      outcome: "OWNER_APPROVAL_REQUIRED",
      assignedRole,
      reasons: ["Explicit owner approval is required before this task may proceed."],
    };
  }

  if (evidenceGatedTasks.has(input.taskType) && !input.evidenceComplete) {
    return {
      allowed: false,
      outcome: "BLOCKED",
      assignedRole,
      reasons: ["This task fails closed until its public-source evidence is complete."],
    };
  }

  return { allowed: true, outcome: "PROCESS", assignedRole, reasons: [] };
}
