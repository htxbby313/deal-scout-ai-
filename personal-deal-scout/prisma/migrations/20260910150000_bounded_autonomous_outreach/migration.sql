-- Campaign-level approval for bounded autonomous seller and buyer outreach.
ALTER TABLE "MessageApproval" ADD COLUMN "propertyId" TEXT;
ALTER TABLE "MessageApproval" ADD COLUMN "developerId" TEXT;

CREATE TABLE "OutreachAuthorization" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "audience" TEXT NOT NULL,
    "allowedChannels" "EngagementChannel"[],
    "approvedPropertyIds" TEXT[],
    "approvedDeveloperIds" TEXT[],
    "maximumMessagesPerDay" INTEGER NOT NULL DEFAULT 10,
    "maximumMessagesPerRecipient" INTEGER NOT NULL DEFAULT 3,
    "maximumFollowUpsPerRecipient" INTEGER NOT NULL DEFAULT 2,
    "sellerOfferCeilingCents" BIGINT,
    "requiredDisclosure" TEXT,
    "prohibitedClaims" TEXT[],
    "escalationTriggers" TEXT[],
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvalFingerprint" TEXT NOT NULL,
    "ownerApprovedAt" TIMESTAMP(3) NOT NULL,
    "ownerApprovedBy" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutreachAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutonomousOutreachDelivery" (
    "id" TEXT NOT NULL,
    "authorizationId" TEXT NOT NULL,
    "messageApprovalId" TEXT NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "channel" "EngagementChannel" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "blockerCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "provider" TEXT,
    "providerReference" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutonomousOutreachDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutreachAuthorization_approvalFingerprint_idx" ON "OutreachAuthorization"("approvalFingerprint");
CREATE INDEX "OutreachAuthorization_campaignId_status_startsAt_expiresAt_idx" ON "OutreachAuthorization"("campaignId", "status", "startsAt", "expiresAt");
CREATE UNIQUE INDEX "AutonomousOutreachDelivery_authorizationId_messageApprovalId_key" ON "AutonomousOutreachDelivery"("authorizationId", "messageApprovalId");
CREATE INDEX "AutonomousOutreachDelivery_authorizationId_status_scheduledAt_idx" ON "AutonomousOutreachDelivery"("authorizationId", "status", "scheduledAt");
CREATE INDEX "AutonomousOutreachDelivery_recipientHash_channel_createdAt_idx" ON "AutonomousOutreachDelivery"("recipientHash", "channel", "createdAt");
CREATE INDEX "MessageApproval_propertyId_status_idx" ON "MessageApproval"("propertyId", "status");
CREATE INDEX "MessageApproval_developerId_status_idx" ON "MessageApproval"("developerId", "status");

ALTER TABLE "MessageApproval" ADD CONSTRAINT "MessageApproval_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageApproval" ADD CONSTRAINT "MessageApproval_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutreachAuthorization" ADD CONSTRAINT "OutreachAuthorization_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AcquisitionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutonomousOutreachDelivery" ADD CONSTRAINT "AutonomousOutreachDelivery_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "OutreachAuthorization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutonomousOutreachDelivery" ADD CONSTRAINT "AutonomousOutreachDelivery_messageApprovalId_fkey" FOREIGN KEY ("messageApprovalId") REFERENCES "MessageApproval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
