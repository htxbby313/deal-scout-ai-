export const AGENT_ROLES = [
  "OPERATIONS_COORDINATOR",
  "RESEARCH",
  "SELLER_ACQUISITION",
  "BUYER_DEVELOPER",
  "PROFIT_UNDERWRITING",
  "COMMUNICATIONS_DISPOSITION",
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
  "UNDERWRITE_PROFIT",
  "PREPARE_ACTION_PACKAGE",
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
  UNDERWRITE_PROFIT: "PROFIT_UNDERWRITING",
  PREPARE_ACTION_PACKAGE: "COMMUNICATIONS_DISPOSITION",
  DRAFT_BUYER_OUTREACH: "BUYER_DEVELOPER",
  REVIEW_COMPLIANCE_EVIDENCE: "TRANSACTION_COMPLIANCE",
  PREPARE_DOCUMENT_CHECKLIST: "TRANSACTION_COMPLIANCE",
  REQUEST_OWNER_APPROVAL: "OPERATIONS_COORDINATOR",
  SEND_OUTBOUND_MESSAGE: "COMMUNICATIONS_DISPOSITION",
  ISSUE_LEGAL_CONCLUSION: "TRANSACTION_COMPLIANCE",
  EXECUTE_CONTRACT: "OPERATIONS_COORDINATOR",
  MOVE_FUNDS: "OPERATIONS_COORDINATOR",
  ISSUE_CLOSING_INSTRUCTION: "TRANSACTION_COMPLIANCE",
};

const permanentlyProhibitedTasks = new Set<AgentTaskType>([
  "ISSUE_LEGAL_CONCLUSION",
  "EXECUTE_CONTRACT",
  "MOVE_FUNDS",
  "ISSUE_CLOSING_INSTRUCTION",
]);

const ownerApprovalGatedTasks = new Set<AgentTaskType>([
  "REQUEST_OWNER_APPROVAL",
]);

const evidenceGatedTasks = new Set<AgentTaskType>([
  "ASSESS_SELLER_FIT",
  "DRAFT_SELLER_OUTREACH",
  "DRAFT_OFFER",
  "MATCH_BUYER",
  "QUALIFY_BUYER",
  "UNDERWRITE_PROFIT",
  "PREPARE_ACTION_PACKAGE",
  "DRAFT_BUYER_OUTREACH",
  "REVIEW_COMPLIANCE_EVIDENCE",
]);

const allowedHandoffs: Readonly<Record<AgentRole, readonly AgentRole[]>> = {
  OPERATIONS_COORDINATOR: ["RESEARCH", "SELLER_ACQUISITION", "BUYER_DEVELOPER", "PROFIT_UNDERWRITING", "COMMUNICATIONS_DISPOSITION", "TRANSACTION_COMPLIANCE"],
  RESEARCH: ["OPERATIONS_COORDINATOR", "SELLER_ACQUISITION", "BUYER_DEVELOPER", "PROFIT_UNDERWRITING", "TRANSACTION_COMPLIANCE"],
  SELLER_ACQUISITION: ["OPERATIONS_COORDINATOR", "RESEARCH", "PROFIT_UNDERWRITING", "COMMUNICATIONS_DISPOSITION", "TRANSACTION_COMPLIANCE"],
  BUYER_DEVELOPER: ["OPERATIONS_COORDINATOR", "RESEARCH", "PROFIT_UNDERWRITING", "COMMUNICATIONS_DISPOSITION", "TRANSACTION_COMPLIANCE"],
  PROFIT_UNDERWRITING: ["OPERATIONS_COORDINATOR", "RESEARCH", "SELLER_ACQUISITION", "BUYER_DEVELOPER", "COMMUNICATIONS_DISPOSITION", "TRANSACTION_COMPLIANCE"],
  COMMUNICATIONS_DISPOSITION: ["OPERATIONS_COORDINATOR", "SELLER_ACQUISITION", "BUYER_DEVELOPER", "TRANSACTION_COMPLIANCE"],
  TRANSACTION_COMPLIANCE: ["OPERATIONS_COORDINATOR", "RESEARCH", "SELLER_ACQUISITION", "BUYER_DEVELOPER", "PROFIT_UNDERWRITING", "COMMUNICATIONS_DISPOSITION"],
};

export type AgentActionZone = "GREEN" | "YELLOW" | "RED";
export type AgentCostClass = "FREE" | "METERED" | "FIXED_COST" | "UNKNOWN_COST";
export type CapabilityGrant = { mode: "AUTOMATIC_INTERNAL" | "APPROVAL_REQUIRED" | "AUTONOMOUS_EXTERNAL" | "BLOCKED"; maximumCostCents: bigint; minimumEvidenceCount: number; active: boolean };

export type WorkflowPolicyInput = {
  role: AgentRole;
  taskType: AgentTaskType;
  transactionControl?: TransactionControl;
  ownerApproved?: boolean;
  evidenceComplete?: boolean;
  evidenceCount?: number;
  operatingMode?: "SUPERVISED" | "AUTONOMOUS";
  autonomyEvidence?: AutonomyEvidence;
  actionZone?: AgentActionZone;
  costClass?: AgentCostClass;
  estimatedCostCents?: bigint;
  capabilityGrant?: CapabilityGrant;
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

export function evaluateSupervisedTrackRecord(statuses: readonly string[], required = 30) {
  const recent = statuses.slice(0, required);
  const blockers: string[] = [];
  if (recent.length < required) blockers.push(`${required - recent.length} more supervised tasks`);
  if (recent.some((status) => status !== "COMPLETED")) blockers.push(`${required} consecutive successful supervised tasks`);
  return { eligible: blockers.length === 0, blockers };
}

export function evaluateAgentTask(input: WorkflowPolicyInput): WorkflowPolicyDecision {
  const assignedRole = taskOwner[input.taskType];
  const actionZone = input.actionZone ?? taskActionPolicy[input.taskType].zone;
  const costClass = input.costClass ?? taskActionPolicy[input.taskType].costClass;
  const estimatedCostCents = input.estimatedCostCents ?? BigInt(0);

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


  if (actionZone === "RED") {
    return { allowed: false, outcome: "BLOCKED", assignedRole, reasons: ["Red-zone actions are prohibited regardless of expected profit or approval."] };
  }
  if (costClass === "UNKNOWN_COST" || estimatedCostCents < BigInt(0)) {
    return { allowed: false, outcome: "BLOCKED", assignedRole, reasons: ["Unknown or invalid cost means no action."] };
  }
  if (actionZone === "GREEN" && (costClass !== "FREE" || estimatedCostCents !== BigInt(0))) {
    return { allowed: false, outcome: "BLOCKED", assignedRole, reasons: ["Automatic internal work must be reversible and zero-cost."] };
  }

  if (input.role !== assignedRole) {
    return {
      allowed: false,
      outcome: canHandoff(input.role, assignedRole) ? "HANDOFF" : "BLOCKED",
      assignedRole,
      reasons: [`${input.taskType} is assigned to the ${assignedRole} agent.`],
    };
  }

  if (actionZone === "GREEN") {
    if (evidenceGatedTasks.has(input.taskType) && !input.evidenceComplete) {
      return { allowed: false, outcome: "BLOCKED", assignedRole, reasons: ["This task fails closed until its public-source evidence is complete."] };
    }
    return { allowed: true, outcome: "PROCESS", assignedRole, reasons: [] };
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


  if (actionZone === "YELLOW" && !input.ownerApproved) {
    const grant = input.capabilityGrant;
    const autonomy = evaluateAutonomyEligibility(input.autonomyEvidence);
    const grantAllows = operatingMode === "AUTONOMOUS" && autonomy.eligible && grant?.active && grant.mode === "AUTONOMOUS_EXTERNAL" && input.evidenceComplete && estimatedCostCents <= grant.maximumCostCents && (input.evidenceCount ?? 0) >= grant.minimumEvidenceCount;
    if (!grantAllows) return { allowed: false, outcome: "OWNER_APPROVAL_REQUIRED", assignedRole, reasons: ["This external or consequential action requires exact owner approval until its capability has a proven, active autonomy grant."] };
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


export const taskActionPolicy: Readonly<Record<AgentTaskType, { zone: AgentActionZone; costClass: AgentCostClass; capability: string }>> = {
  COORDINATE_PIPELINE: { zone: "GREEN", costClass: "FREE", capability: "PIPELINE_COORDINATION" },
  RESEARCH_PROPERTY: { zone: "GREEN", costClass: "FREE", capability: "PUBLIC_PROPERTY_RESEARCH" },
  RESEARCH_DEVELOPER: { zone: "GREEN", costClass: "FREE", capability: "PUBLIC_DEVELOPER_RESEARCH" },
  VERIFY_PUBLIC_SOURCE: { zone: "GREEN", costClass: "FREE", capability: "PUBLIC_SOURCE_VERIFICATION" },
  ASSESS_SELLER_FIT: { zone: "GREEN", costClass: "FREE", capability: "SELLER_OPPORTUNITY_ANALYSIS" },
  DRAFT_SELLER_OUTREACH: { zone: "GREEN", costClass: "FREE", capability: "SELLER_DRAFTING" },
  DRAFT_OFFER: { zone: "GREEN", costClass: "FREE", capability: "OFFER_DRAFTING" },
  MATCH_BUYER: { zone: "GREEN", costClass: "FREE", capability: "BUYER_MATCHING" },
  QUALIFY_BUYER: { zone: "GREEN", costClass: "FREE", capability: "BUYER_QUALIFICATION" },
  UNDERWRITE_PROFIT: { zone: "GREEN", costClass: "FREE", capability: "PROFIT_UNDERWRITING" },
  PREPARE_ACTION_PACKAGE: { zone: "GREEN", costClass: "FREE", capability: "ACTION_PACKAGE_PREPARATION" },
  DRAFT_BUYER_OUTREACH: { zone: "GREEN", costClass: "FREE", capability: "BUYER_DRAFTING" },
  REVIEW_COMPLIANCE_EVIDENCE: { zone: "GREEN", costClass: "FREE", capability: "COMPLIANCE_REVIEW" },
  PREPARE_DOCUMENT_CHECKLIST: { zone: "GREEN", costClass: "FREE", capability: "DOCUMENT_CHECKLIST" },
  REQUEST_OWNER_APPROVAL: { zone: "YELLOW", costClass: "FREE", capability: "OWNER_APPROVAL_REQUEST" },
  SEND_OUTBOUND_MESSAGE: { zone: "YELLOW", costClass: "METERED", capability: "OUTBOUND_MESSAGE" },
  ISSUE_LEGAL_CONCLUSION: { zone: "RED", costClass: "UNKNOWN_COST", capability: "LEGAL_CONCLUSION" },
  EXECUTE_CONTRACT: { zone: "RED", costClass: "UNKNOWN_COST", capability: "CONTRACT_EXECUTION" },
  MOVE_FUNDS: { zone: "RED", costClass: "UNKNOWN_COST", capability: "FUNDS_MOVEMENT" },
  ISSUE_CLOSING_INSTRUCTION: { zone: "RED", costClass: "UNKNOWN_COST", capability: "CLOSING_INSTRUCTION" },
};
