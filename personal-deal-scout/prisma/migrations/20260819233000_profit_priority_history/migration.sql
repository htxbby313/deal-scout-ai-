CREATE TYPE "ProfitPriorityConfigurationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

CREATE TABLE "ProfitPriorityScoreConfiguration" (
  "id" TEXT NOT NULL, "version" INTEGER NOT NULL, "status" "ProfitPriorityConfigurationStatus" NOT NULL DEFAULT 'DRAFT',
  "projectedProfitWeight" INTEGER NOT NULL, "probabilityWeight" INTEGER NOT NULL, "sellerFitWeight" INTEGER NOT NULL,
  "evidenceWeight" INTEGER NOT NULL, "buyerCoverageWeight" INTEGER NOT NULL, "velocityWeight" INTEGER NOT NULL,
  "riskPenaltyWeight" INTEGER NOT NULL, "effectiveAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "reason" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfitPriorityScoreConfiguration_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProfitPriorityScoreHistory" (
  "id" TEXT NOT NULL, "funnelId" TEXT NOT NULL, "configurationId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "totalScore" INTEGER NOT NULL, "projectedProfitScore" INTEGER NOT NULL, "probabilityScore" INTEGER NOT NULL,
  "sellerFitScore" INTEGER NOT NULL, "evidenceScore" INTEGER NOT NULL, "buyerCoverageScore" INTEGER NOT NULL,
  "velocityScore" INTEGER NOT NULL, "riskPenaltyScore" INTEGER NOT NULL, "projectedBaseCents" BIGINT NOT NULL,
  "probabilityWeightedCents" BIGINT NOT NULL, "contractedFeeCents" BIGINT, "realizedProfitCents" BIGINT,
  "reasons" TEXT[], "blockers" TEXT[], "inputSnapshot" JSONB NOT NULL, "calculatedBy" TEXT NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfitPriorityScoreHistory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProfitPriorityScoreConfiguration_version_key" ON "ProfitPriorityScoreConfiguration"("version");
CREATE INDEX "ProfitPriorityScoreConfiguration_status_effectiveAt_expiresAt_idx" ON "ProfitPriorityScoreConfiguration"("status", "effectiveAt", "expiresAt");
CREATE UNIQUE INDEX "ProfitPriorityScoreHistory_funnelId_version_key" ON "ProfitPriorityScoreHistory"("funnelId", "version");
CREATE INDEX "ProfitPriorityScoreHistory_funnelId_calculatedAt_idx" ON "ProfitPriorityScoreHistory"("funnelId", "calculatedAt");
CREATE INDEX "ProfitPriorityScoreHistory_totalScore_expiresAt_idx" ON "ProfitPriorityScoreHistory"("totalScore", "expiresAt");
CREATE INDEX "ProfitPriorityScoreHistory_configurationId_idx" ON "ProfitPriorityScoreHistory"("configurationId");
ALTER TABLE "ProfitPriorityScoreHistory" ADD CONSTRAINT "ProfitPriorityScoreHistory_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "AcquisitionFunnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfitPriorityScoreHistory" ADD CONSTRAINT "ProfitPriorityScoreHistory_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "ProfitPriorityScoreConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
