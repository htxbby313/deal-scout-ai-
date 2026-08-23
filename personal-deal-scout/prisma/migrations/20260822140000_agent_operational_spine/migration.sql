ALTER TYPE "AgentRole" ADD VALUE IF NOT EXISTS 'PROFIT_UNDERWRITING';
ALTER TYPE "AgentRole" ADD VALUE IF NOT EXISTS 'COMMUNICATIONS_DISPOSITION';

CREATE TYPE "AgentActionZone" AS ENUM ('GREEN', 'YELLOW', 'RED');
CREATE TYPE "AgentCostClass" AS ENUM ('FREE', 'METERED', 'FIXED_COST', 'UNKNOWN_COST');
CREATE TYPE "AgentSchedulerStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');
CREATE TYPE "AgentCycleTrigger" AS ENUM ('CRON', 'OWNER', 'EVENT', 'RECOVERY');
CREATE TYPE "AgentCapabilityMode" AS ENUM ('AUTOMATIC_INTERNAL', 'APPROVAL_REQUIRED', 'AUTONOMOUS_EXTERNAL', 'BLOCKED');

ALTER TABLE "AgentTask"
  ADD COLUMN "actionZone" "AgentActionZone" NOT NULL DEFAULT 'GREEN',
  ADD COLUMN "costClass" "AgentCostClass" NOT NULL DEFAULT 'FREE',
  ADD COLUMN "capability" TEXT NOT NULL DEFAULT 'INTERNAL_RESEARCH',
  ADD COLUMN "estimatedCostCents" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "expectedValueCents" BIGINT,
  ADD COLUMN "expectedBenefit" TEXT,
  ADD COLUMN "materialRisks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "AgentCapabilityGrant" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "mode" "AgentCapabilityMode" NOT NULL,
  "jurisdictionState" TEXT,
  "channel" TEXT,
  "maximumCostCents" BIGINT NOT NULL DEFAULT 0,
  "minimumEvidenceCount" INTEGER NOT NULL DEFAULT 1,
  "minimumSuccessfulRuns" INTEGER NOT NULL DEFAULT 30,
  "counselApprovedAt" TIMESTAMP(3),
  "complianceApprovedAt" TIMESTAMP(3),
  "ownerApprovedAt" TIMESTAMP(3),
  "ownerApprovedBy" TEXT,
  "expiresAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "suspensionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentCapabilityGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgentCapabilityGrant_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AgentCapabilityGrant_agentId_capability_jurisdictionState_channel_key" ON "AgentCapabilityGrant"("agentId", "capability", "jurisdictionState", "channel");
CREATE INDEX "AgentCapabilityGrant_mode_expiresAt_suspendedAt_idx" ON "AgentCapabilityGrant"("mode", "expiresAt", "suspendedAt");

CREATE TABLE "AgentSchedulerCycle" (
  "id" TEXT NOT NULL,
  "trigger" "AgentCycleTrigger" NOT NULL,
  "status" "AgentSchedulerStatus" NOT NULL DEFAULT 'RUNNING',
  "deploymentId" TEXT,
  "tasksCreated" INTEGER NOT NULL DEFAULT 0,
  "tasksProcessed" INTEGER NOT NULL DEFAULT 0,
  "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
  "tasksFailed" INTEGER NOT NULL DEFAULT 0,
  "tasksWaitingApproval" INTEGER NOT NULL DEFAULT 0,
  "propertiesConsidered" INTEGER NOT NULL DEFAULT 0,
  "developersConsidered" INTEGER NOT NULL DEFAULT 0,
  "transactionsConsidered" INTEGER NOT NULL DEFAULT 0,
  "researchSummary" JSONB,
  "errors" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "AgentSchedulerCycle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentSchedulerCycle_status_startedAt_idx" ON "AgentSchedulerCycle"("status", "startedAt");
CREATE INDEX "AgentSchedulerCycle_trigger_startedAt_idx" ON "AgentSchedulerCycle"("trigger", "startedAt");

ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_green_free_check"
CHECK ("actionZone" <> 'GREEN' OR ("costClass" = 'FREE' AND "estimatedCostCents" = 0));

ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_red_not_executable_check"
CHECK ("actionZone" <> 'RED' OR "status" IN ('BLOCKED', 'CANCELLED', 'FAILED'));
