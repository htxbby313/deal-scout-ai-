CREATE TYPE "AcquisitionStage" AS ENUM ('DISCOVERED', 'RESEARCHABLE', 'BUYER_FIT', 'OUTREACH_READY', 'SELLER_ENGAGED', 'UNDERWRITING_READY', 'OFFER_READY', 'CONTRACTED', 'DISPOSITION_READY', 'CLOSED', 'DISQUALIFIED', 'NURTURE', 'ARCHIVED');
CREATE TYPE "AcquisitionGateType" AS ENUM ('PROPERTY_EVIDENCE', 'SELLER_CONTACT', 'UNDERWRITING', 'COMPLIANCE', 'CONTRACT', 'BUYER_COVERAGE', 'DISPOSITION', 'CLOSING');
CREATE TYPE "AcquisitionGateStatus" AS ENUM ('PENDING', 'SATISFIED', 'FAILED', 'EXPIRED', 'WAIVED');
CREATE TYPE "BuyerDemandStatus" AS ENUM ('DRAFT', 'VERIFIED', 'EXPIRED', 'SUPERSEDED');
CREATE TYPE "BuyerEvidenceStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');
CREATE TYPE "BuyerCoverageRole" AS ENUM ('PRIMARY', 'BACKUP');
CREATE TYPE "BuyerCoverageStatus" AS ENUM ('CANDIDATE', 'CONFIRMED', 'DECLINED', 'EXPIRED');
CREATE TYPE "AcquisitionCampaignType" AS ENUM ('SELLER_ACQUISITION', 'BUYER_DISPOSITION');
CREATE TYPE "AcquisitionCampaignStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "AcquisitionFunnel" (
  "id" TEXT NOT NULL, "propertyId" TEXT NOT NULL, "transactionId" TEXT,
  "stage" "AcquisitionStage" NOT NULL DEFAULT 'DISCOVERED', "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcquisitionFunnel_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AcquisitionStageHistory" (
  "id" TEXT NOT NULL, "funnelId" TEXT NOT NULL, "sequence" INTEGER NOT NULL, "fromStage" "AcquisitionStage", "toStage" "AcquisitionStage" NOT NULL,
  "actor" TEXT NOT NULL, "reason" TEXT NOT NULL, "evidence" JSONB, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcquisitionStageHistory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AcquisitionGate" (
  "id" TEXT NOT NULL, "funnelId" TEXT NOT NULL, "type" "AcquisitionGateType" NOT NULL, "version" INTEGER NOT NULL,
  "status" "AcquisitionGateStatus" NOT NULL DEFAULT 'PENDING', "evidence" JSONB, "sourceUrl" TEXT, "decidedBy" TEXT,
  "decidedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcquisitionGate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BuyerDemandVersion" (
  "id" TEXT NOT NULL, "developerId" TEXT NOT NULL, "version" INTEGER NOT NULL, "status" "BuyerDemandStatus" NOT NULL DEFAULT 'DRAFT',
  "states" TEXT[], "counties" TEXT[], "zipCodes" TEXT[], "assetTypes" TEXT[], "minPurchasePriceCents" BIGINT, "maxPurchasePriceCents" BIGINT,
  "minAcres" DOUBLE PRECISION, "maxAcres" DOUBLE PRECISION, "maxAssignmentFeeCents" BIGINT, "strategy" TEXT, "sourceUrl" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3), "effectiveAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BuyerDemandVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BuyerCapacityEvidence" (
  "id" TEXT NOT NULL, "developerId" TEXT NOT NULL, "version" INTEGER NOT NULL, "status" "BuyerEvidenceStatus" NOT NULL DEFAULT 'PENDING',
  "amountCents" BIGINT, "sourceUrl" TEXT NOT NULL, "verifiedBy" TEXT, "verifiedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BuyerCapacityEvidence_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BuyerReliabilityEvidence" (
  "id" TEXT NOT NULL, "developerId" TEXT NOT NULL, "version" INTEGER NOT NULL, "status" "BuyerEvidenceStatus" NOT NULL DEFAULT 'PENDING',
  "completedClosings" INTEGER NOT NULL DEFAULT 0, "failedClosings" INTEGER NOT NULL DEFAULT 0, "averageCloseDays" INTEGER,
  "sourceUrl" TEXT NOT NULL, "verifiedBy" TEXT, "verifiedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BuyerReliabilityEvidence_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BuyerCoverage" (
  "id" TEXT NOT NULL, "funnelId" TEXT NOT NULL, "demandVersionId" TEXT NOT NULL, "role" "BuyerCoverageRole" NOT NULL,
  "status" "BuyerCoverageStatus" NOT NULL DEFAULT 'CANDIDATE', "matchScore" INTEGER NOT NULL, "reasons" TEXT[],
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "confirmedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BuyerCoverage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AcquisitionCampaign" (
  "id" TEXT NOT NULL, "funnelId" TEXT, "type" "AcquisitionCampaignType" NOT NULL, "status" "AcquisitionCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "name" TEXT NOT NULL, "jurisdictionState" TEXT NOT NULL, "requiresOwnerApproval" BOOLEAN NOT NULL DEFAULT true,
  "ownerApprovedAt" TIMESTAMP(3), "ownerApprovedBy" TEXT, "outboundEnabled" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMP(3), "endsAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcquisitionCampaign_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AcquisitionCampaignBoundary" (
  "id" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "version" INTEGER NOT NULL, "allowedStates" TEXT[], "allowedChannels" TEXT[],
  "audienceCriteria" JSONB NOT NULL, "sourceRequirements" JSONB NOT NULL, "doNotContactEnforced" BOOLEAN NOT NULL DEFAULT true,
  "consentRequired" BOOLEAN NOT NULL DEFAULT true, "maxRecipientsPerDay" INTEGER NOT NULL DEFAULT 0,
  "effectiveAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcquisitionCampaignBoundary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcquisitionFunnel_transactionId_key" ON "AcquisitionFunnel"("transactionId");
CREATE INDEX "AcquisitionFunnel_stage_expiresAt_idx" ON "AcquisitionFunnel"("stage", "expiresAt");
CREATE INDEX "AcquisitionFunnel_propertyId_createdAt_idx" ON "AcquisitionFunnel"("propertyId", "createdAt");
CREATE UNIQUE INDEX "AcquisitionStageHistory_funnelId_sequence_key" ON "AcquisitionStageHistory"("funnelId", "sequence");
CREATE INDEX "AcquisitionStageHistory_funnelId_occurredAt_idx" ON "AcquisitionStageHistory"("funnelId", "occurredAt");
CREATE UNIQUE INDEX "AcquisitionGate_funnelId_type_version_key" ON "AcquisitionGate"("funnelId", "type", "version");
CREATE INDEX "AcquisitionGate_funnelId_type_status_expiresAt_idx" ON "AcquisitionGate"("funnelId", "type", "status", "expiresAt");
CREATE UNIQUE INDEX "BuyerDemandVersion_developerId_version_key" ON "BuyerDemandVersion"("developerId", "version");
CREATE INDEX "BuyerDemandVersion_status_expiresAt_idx" ON "BuyerDemandVersion"("status", "expiresAt");
CREATE INDEX "BuyerDemandVersion_developerId_createdAt_idx" ON "BuyerDemandVersion"("developerId", "createdAt");
CREATE UNIQUE INDEX "BuyerCapacityEvidence_developerId_version_key" ON "BuyerCapacityEvidence"("developerId", "version");
CREATE INDEX "BuyerCapacityEvidence_developerId_status_expiresAt_idx" ON "BuyerCapacityEvidence"("developerId", "status", "expiresAt");
CREATE UNIQUE INDEX "BuyerReliabilityEvidence_developerId_version_key" ON "BuyerReliabilityEvidence"("developerId", "version");
CREATE INDEX "BuyerReliabilityEvidence_developerId_status_expiresAt_idx" ON "BuyerReliabilityEvidence"("developerId", "status", "expiresAt");
CREATE UNIQUE INDEX "BuyerCoverage_funnelId_demandVersionId_key" ON "BuyerCoverage"("funnelId", "demandVersionId");
CREATE INDEX "BuyerCoverage_funnelId_role_status_expiresAt_idx" ON "BuyerCoverage"("funnelId", "role", "status", "expiresAt");
CREATE INDEX "AcquisitionCampaign_status_startsAt_endsAt_idx" ON "AcquisitionCampaign"("status", "startsAt", "endsAt");
CREATE INDEX "AcquisitionCampaign_funnelId_idx" ON "AcquisitionCampaign"("funnelId");
CREATE UNIQUE INDEX "AcquisitionCampaignBoundary_campaignId_version_key" ON "AcquisitionCampaignBoundary"("campaignId", "version");
CREATE INDEX "AcquisitionCampaignBoundary_campaignId_effectiveAt_expiresAt_idx" ON "AcquisitionCampaignBoundary"("campaignId", "effectiveAt", "expiresAt");

ALTER TABLE "AcquisitionFunnel" ADD CONSTRAINT "AcquisitionFunnel_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcquisitionFunnel" ADD CONSTRAINT "AcquisitionFunnel_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "DealTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcquisitionStageHistory" ADD CONSTRAINT "AcquisitionStageHistory_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "AcquisitionFunnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcquisitionGate" ADD CONSTRAINT "AcquisitionGate_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "AcquisitionFunnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BuyerDemandVersion" ADD CONSTRAINT "BuyerDemandVersion_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BuyerCapacityEvidence" ADD CONSTRAINT "BuyerCapacityEvidence_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BuyerReliabilityEvidence" ADD CONSTRAINT "BuyerReliabilityEvidence_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BuyerCoverage" ADD CONSTRAINT "BuyerCoverage_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "AcquisitionFunnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BuyerCoverage" ADD CONSTRAINT "BuyerCoverage_demandVersionId_fkey" FOREIGN KEY ("demandVersionId") REFERENCES "BuyerDemandVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcquisitionCampaign" ADD CONSTRAINT "AcquisitionCampaign_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "AcquisitionFunnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AcquisitionCampaignBoundary" ADD CONSTRAINT "AcquisitionCampaignBoundary_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AcquisitionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
