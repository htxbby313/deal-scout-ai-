CREATE TABLE "CampaignCountyCoverage" (
  "id" TEXT PRIMARY KEY,
  "campaignId" TEXT NOT NULL,
  "registryId" TEXT NOT NULL,
  "status" "CountyCoverageStatus" NOT NULL,
  "reason" TEXT,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "CampaignCountyCoverage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AcquisitionCampaign"("id") ON DELETE RESTRICT,
  CONSTRAINT "CampaignCountyCoverage_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "CountySourceRegistry"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "CampaignCountyCoverage_campaignId_registryId_key" ON "CampaignCountyCoverage"("campaignId","registryId");
CREATE INDEX "CampaignCountyCoverage_status_expiresAt_idx" ON "CampaignCountyCoverage"("status","expiresAt");
