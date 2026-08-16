CREATE TABLE "GovernmentResearchRun" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "period" TEXT,
  "recordsFound" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernmentResearchRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketSignal" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "fips" TEXT NOT NULL,
  "stateFips" TEXT NOT NULL,
  "countyFips" TEXT NOT NULL,
  "countyName" TEXT NOT NULL,
  "stateName" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "currentUnits" INTEGER NOT NULL,
  "priorUnits" INTEGER NOT NULL,
  "growthPct" DOUBLE PRECISION NOT NULL,
  "currentValue" BIGINT NOT NULL,
  "rank" INTEGER NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernmentResearchRun_createdAt_idx" ON "GovernmentResearchRun"("createdAt");
CREATE INDEX "MarketSignal_period_rank_idx" ON "MarketSignal"("period", "rank");
CREATE UNIQUE INDEX "MarketSignal_source_fips_period_key" ON "MarketSignal"("source", "fips", "period");
