CREATE TYPE "AgentRole" AS ENUM ('OPERATIONS_COORDINATOR', 'RESEARCH', 'SELLER_ACQUISITION', 'BUYER_DEVELOPER', 'TRANSACTION_COMPLIANCE');
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');
CREATE TYPE "AgentAutonomyMode" AS ENUM ('LOCKED', 'SUPERVISED', 'APPROVED_AUTONOMOUS');
CREATE TYPE "AgentTaskStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'WAITING_FOR_APPROVAL', 'BLOCKED', 'COMPLETED', 'CANCELLED', 'FAILED');
CREATE TYPE "AgentTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'WAITING_FOR_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "AgentEventType" AS ENUM ('TASK_CREATED', 'TASK_STARTED', 'TASK_UPDATED', 'HANDOFF_REQUESTED', 'HANDOFF_ACCEPTED', 'APPROVAL_REQUESTED', 'APPROVAL_DECIDED', 'RUN_COMPLETED', 'RUN_FAILED', 'TASK_COMPLETED', 'TASK_CANCELLED');

CREATE TABLE "Agent" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "AgentRole" NOT NULL,
  "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
  "autonomyMode" "AgentAutonomyMode" NOT NULL DEFAULT 'LOCKED',
  "description" TEXT,
  "autonomousOutbound" BOOLEAN NOT NULL DEFAULT false,
  "legalStandardsProvenAt" TIMESTAMP(3),
  "ethicalStandardsProvenAt" TIMESTAMP(3),
  "complianceApprovedAt" TIMESTAMP(3),
  "counselApprovedAt" TIMESTAMP(3),
  "ownerAutonomyApprovedAt" TIMESTAMP(3),
  "ownerAutonomyApprovedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Agent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Agent_no_autonomous_outbound_check" CHECK ("autonomousOutbound" = false),
  CONSTRAINT "Agent_autonomy_evidence_check" CHECK (
    "autonomyMode" <> 'APPROVED_AUTONOMOUS'
    OR (
      "legalStandardsProvenAt" IS NOT NULL
      AND "ethicalStandardsProvenAt" IS NOT NULL
      AND "complianceApprovedAt" IS NOT NULL
      AND "counselApprovedAt" IS NOT NULL
      AND "ownerAutonomyApprovedAt" IS NOT NULL
      AND "ownerAutonomyApprovedBy" IS NOT NULL
    )
  )
);

CREATE TABLE "AgentTask" (
  "id" TEXT NOT NULL,
  "assignedAgentId" TEXT NOT NULL,
  "taskType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "AgentTaskStatus" NOT NULL DEFAULT 'QUEUED',
  "priority" "AgentTaskPriority" NOT NULL DEFAULT 'NORMAL',
  "ownerApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
  "ownerApprovedAt" TIMESTAMP(3),
  "ownerApprovedBy" TEXT,
  "approvalReason" TEXT,
  "evidenceCount" INTEGER NOT NULL DEFAULT 0,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "output" JSONB,
  "transactionId" TEXT,
  "propertyId" TEXT,
  "developerId" TEXT,
  "dueAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentRun" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
  "summary" TEXT,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentEvent" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "runId" TEXT,
  "actorAgentId" TEXT,
  "sourceAgentId" TEXT,
  "targetAgentId" TEXT,
  "type" "AgentEventType" NOT NULL,
  "summary" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Agent_role_key" ON "Agent"("role");
CREATE INDEX "Agent_status_autonomyMode_idx" ON "Agent"("status", "autonomyMode");
CREATE INDEX "AgentTask_assignedAgentId_status_priority_idx" ON "AgentTask"("assignedAgentId", "status", "priority");
CREATE INDEX "AgentTask_transactionId_status_idx" ON "AgentTask"("transactionId", "status");
CREATE INDEX "AgentTask_propertyId_idx" ON "AgentTask"("propertyId");
CREATE INDEX "AgentTask_developerId_idx" ON "AgentTask"("developerId");
CREATE INDEX "AgentRun_taskId_startedAt_idx" ON "AgentRun"("taskId", "startedAt");
CREATE INDEX "AgentRun_agentId_status_startedAt_idx" ON "AgentRun"("agentId", "status", "startedAt");
CREATE INDEX "AgentEvent_taskId_createdAt_idx" ON "AgentEvent"("taskId", "createdAt");
CREATE INDEX "AgentEvent_targetAgentId_type_createdAt_idx" ON "AgentEvent"("targetAgentId", "type", "createdAt");
CREATE INDEX "AgentEvent_runId_idx" ON "AgentEvent"("runId");

ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "DealTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AgentTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentEvent" ADD CONSTRAINT "AgentEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AgentTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentEvent" ADD CONSTRAINT "AgentEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentEvent" ADD CONSTRAINT "AgentEvent_actorAgentId_fkey" FOREIGN KEY ("actorAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentEvent" ADD CONSTRAINT "AgentEvent_sourceAgentId_fkey" FOREIGN KEY ("sourceAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentEvent" ADD CONSTRAINT "AgentEvent_targetAgentId_fkey" FOREIGN KEY ("targetAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
