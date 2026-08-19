CREATE TYPE "EngagementChannel" AS ENUM ('EMAIL','SMS','PHONE','MAIL','INTERNAL');
CREATE TYPE "SellerEngagementStatus" AS ENUM ('DRAFT','BLOCKED','READY_FOR_OWNER_REVIEW','OWNER_APPROVED','COMPLETED','CANCELLED');
CREATE TYPE "ConsentStatus" AS ENUM ('UNKNOWN','GRANTED','DENIED','REVOKED','EXPIRED');
CREATE TYPE "DiligenceLevel" AS ENUM ('PRELIMINARY','ENHANCED');
CREATE TYPE "DiligenceStatus" AS ENUM ('PENDING','IN_PROGRESS','NEEDS_MANUAL_VERIFICATION','VERIFIED','REJECTED');
CREATE TYPE "ProviderReadinessStatus" AS ENUM ('DISABLED','CONFIGURATION_NEEDED','REVIEW_NEEDED','READY','SUSPENDED');
CREATE TYPE "TransactionOutcomeStatus" AS ENUM ('OPEN','CLOSED_ASSIGNED','CLOSED_PURCHASED','CANCELLED','FAILED');
CREATE TYPE "LearningObservationStatus" AS ENUM ('OBSERVED','REVIEWED','REJECTED','APPROVED_FOR_MANUAL_CHANGE');

CREATE TABLE "SellerEngagement" ("id" TEXT NOT NULL,"transactionId" TEXT NOT NULL,"channel" "EngagementChannel" NOT NULL,"recipientHash" TEXT NOT NULL,"recipientLabel" TEXT,"jurisdictionState" TEXT NOT NULL,"status" "SellerEngagementStatus" NOT NULL DEFAULT 'DRAFT',"purpose" TEXT NOT NULL,"ownerApprovedAt" TIMESTAMP(3),"ownerApprovedBy" TEXT,"completedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "SellerEngagement_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ContactSuppression" ("id" TEXT NOT NULL,"recipientHash" TEXT NOT NULL,"channel" "EngagementChannel" NOT NULL,"jurisdictionState" TEXT,"reason" TEXT NOT NULL,"source" TEXT NOT NULL,"effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"expiresAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ContactSuppression_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ContactConsent" ("id" TEXT NOT NULL,"engagementId" TEXT NOT NULL,"channel" "EngagementChannel" NOT NULL,"status" "ConsentStatus" NOT NULL DEFAULT 'UNKNOWN',"evidenceUrl" TEXT,"evidenceNote" TEXT,"capturedAt" TIMESTAMP(3) NOT NULL,"expiresAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ContactConsent_pkey" PRIMARY KEY ("id"));
CREATE TABLE "StateChannelPolicy" ("id" TEXT NOT NULL,"jurisdictionState" TEXT NOT NULL,"channel" "EngagementChannel" NOT NULL,"enabled" BOOLEAN NOT NULL DEFAULT false,"counselApprovedAt" TIMESTAMP(3),"reviewedAt" TIMESTAMP(3),"sourceUrl" TEXT,"notes" TEXT,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "StateChannelPolicy_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DiligenceReview" ("id" TEXT NOT NULL,"transactionId" TEXT NOT NULL,"level" "DiligenceLevel" NOT NULL,"status" "DiligenceStatus" NOT NULL DEFAULT 'PENDING',"evidenceCount" INTEGER NOT NULL DEFAULT 0,"unresolvedCount" INTEGER NOT NULL DEFAULT 0,"reviewer" TEXT,"sourceManifest" JSONB,"conclusion" TEXT,"startedAt" TIMESTAMP(3),"completedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "DiligenceReview_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ProviderIntegrationReadiness" ("id" TEXT NOT NULL,"provider" TEXT NOT NULL,"channel" "EngagementChannel" NOT NULL,"status" "ProviderReadinessStatus" NOT NULL DEFAULT 'DISABLED',"credentialsConfigured" BOOLEAN NOT NULL DEFAULT false,"webhookVerified" BOOLEAN NOT NULL DEFAULT false,"suppressionIntegrated" BOOLEAN NOT NULL DEFAULT false,"auditIntegrated" BOOLEAN NOT NULL DEFAULT false,"ownerEnabled" BOOLEAN NOT NULL DEFAULT false,"reviewedAt" TIMESTAMP(3),"notes" TEXT,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ProviderIntegrationReadiness_pkey" PRIMARY KEY ("id"));
CREATE TABLE "TransactionOutcome" ("id" TEXT NOT NULL,"transactionId" TEXT NOT NULL,"status" "TransactionOutcomeStatus" NOT NULL DEFAULT 'OPEN',"sellerProceeds" INTEGER,"assignmentFee" INTEGER,"transactionCosts" INTEGER,"cycleDays" INTEGER,"cancellationReason" TEXT,"evidence" JSONB,"finalizedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "TransactionOutcome_pkey" PRIMARY KEY ("id"));
CREATE TABLE "LearningObservation" ("id" TEXT NOT NULL,"outcomeId" TEXT NOT NULL,"status" "LearningObservationStatus" NOT NULL DEFAULT 'OBSERVED',"metric" TEXT NOT NULL,"observedValue" DOUBLE PRECISION,"hypothesis" TEXT NOT NULL,"evidence" JSONB,"ownerReviewedAt" TIMESTAMP(3),"ownerReviewedBy" TEXT,"appliedAutomatically" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "LearningObservation_pkey" PRIMARY KEY ("id"),CONSTRAINT "LearningObservation_no_self_modification_check" CHECK ("appliedAutomatically" = false));

CREATE INDEX "SellerEngagement_transactionId_status_idx" ON "SellerEngagement"("transactionId","status");
CREATE INDEX "SellerEngagement_recipientHash_channel_idx" ON "SellerEngagement"("recipientHash","channel");
CREATE INDEX "ContactSuppression_recipientHash_channel_effectiveAt_idx" ON "ContactSuppression"("recipientHash","channel","effectiveAt");
CREATE INDEX "ContactConsent_engagementId_channel_capturedAt_idx" ON "ContactConsent"("engagementId","channel","capturedAt");
CREATE UNIQUE INDEX "StateChannelPolicy_jurisdictionState_channel_key" ON "StateChannelPolicy"("jurisdictionState","channel");
CREATE UNIQUE INDEX "DiligenceReview_transactionId_level_key" ON "DiligenceReview"("transactionId","level");
CREATE INDEX "DiligenceReview_status_level_idx" ON "DiligenceReview"("status","level");
CREATE UNIQUE INDEX "ProviderIntegrationReadiness_provider_channel_key" ON "ProviderIntegrationReadiness"("provider","channel");
CREATE INDEX "TransactionOutcome_transactionId_status_idx" ON "TransactionOutcome"("transactionId","status");
CREATE INDEX "LearningObservation_status_createdAt_idx" ON "LearningObservation"("status","createdAt");

ALTER TABLE "SellerEngagement" ADD CONSTRAINT "SellerEngagement_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "DealTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContactConsent" ADD CONSTRAINT "ContactConsent_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "SellerEngagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiligenceReview" ADD CONSTRAINT "DiligenceReview_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "DealTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionOutcome" ADD CONSTRAINT "TransactionOutcome_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "DealTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningObservation" ADD CONSTRAINT "LearningObservation_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "TransactionOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_finalized_outcome_mutation() RETURNS trigger AS $$ BEGIN IF OLD."finalizedAt" IS NOT NULL THEN RAISE EXCEPTION 'Finalized transaction outcomes are immutable'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "TransactionOutcome_finalized_immutable" BEFORE UPDATE OR DELETE ON "TransactionOutcome" FOR EACH ROW EXECUTE FUNCTION prevent_finalized_outcome_mutation();
CREATE OR REPLACE FUNCTION prevent_compliance_evidence_deletion() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Compliance evidence records cannot be deleted'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ContactSuppression_no_delete" BEFORE DELETE ON "ContactSuppression" FOR EACH ROW EXECUTE FUNCTION prevent_compliance_evidence_deletion();
CREATE TRIGGER "ContactConsent_no_delete" BEFORE DELETE ON "ContactConsent" FOR EACH ROW EXECUTE FUNCTION prevent_compliance_evidence_deletion();
