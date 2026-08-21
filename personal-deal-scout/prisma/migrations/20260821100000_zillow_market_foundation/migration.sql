CREATE TYPE "ExternalProviderStatus" AS ENUM ('DISABLED', 'MOCK_ONLY', 'READY', 'ACTIVE', 'PAUSED', 'CIRCUIT_OPEN');
CREATE TYPE "MarketDatasetImportStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'QUARANTINED', 'FAILED');
CREATE TYPE "DiscoveryReferenceStatus" AS ENUM ('SUBMITTED', 'MATCHED', 'CREATED_PROPERTY', 'NEEDS_REVIEW', 'REJECTED');

CREATE TABLE "ExternalProvider" (
  "id" TEXT NOT NULL, "key" TEXT NOT NULL, "displayName" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "status" "ExternalProviderStatus" NOT NULL DEFAULT 'DISABLED', "liveRequestsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "policy" JSONB NOT NULL, "timeoutMs" INTEGER NOT NULL DEFAULT 15000, "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "quotaLimit" INTEGER, "quotaWindow" TEXT, "nextEligibleAt" TIMESTAMP(3), "circuitOpenUntil" TIMESTAMP(3),
  "failureCount" INTEGER NOT NULL DEFAULT 0, "activatedAt" TIMESTAMP(3), "activatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalProvider_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalProvider_limits_check" CHECK ("timeoutMs" BETWEEN 1 AND 60000 AND "maxAttempts" BETWEEN 1 AND 5 AND "failureCount" >= 0),
  CONSTRAINT "ExternalProvider_live_gate_check" CHECK (NOT "liveRequestsEnabled" OR "status" = 'ACTIVE')
);

CREATE TABLE "ProviderJobCheckpoint" (
  "id" TEXT NOT NULL, "providerId" TEXT NOT NULL, "workType" TEXT NOT NULL, "cursor" TEXT, "state" JSONB,
  "nextEligibleAt" TIMESTAMP(3), "lastStartedAt" TIMESTAMP(3), "lastFinishedAt" TIMESTAMP(3), "lastError" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderJobCheckpoint_pkey" PRIMARY KEY ("id"), CONSTRAINT "ProviderJobCheckpoint_version_check" CHECK ("version" >= 1)
);

CREATE TABLE "MarketDatasetDefinition" (
  "id" TEXT NOT NULL, "providerId" TEXT NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL, "definition" TEXT NOT NULL,
  "canonicalCatalogUrl" TEXT NOT NULL, "directUrl" TEXT NOT NULL, "geography" TEXT NOT NULL, "propertyType" TEXT NOT NULL,
  "frequency" TEXT NOT NULL, "identifierColumns" TEXT[], "dateColumnPattern" TEXT NOT NULL, "expectedContentType" TEXT NOT NULL,
  "expectedMaximumBytes" INTEGER NOT NULL, "attributionNote" TEXT NOT NULL, "fixtureHash" TEXT NOT NULL,
  "reviewedBy" TEXT NOT NULL, "reviewedAt" TIMESTAMP(3) NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketDatasetDefinition_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketDatasetDefinition_size_check" CHECK ("expectedMaximumBytes" BETWEEN 1 AND 52428800)
);

CREATE TABLE "MarketDatasetImport" (
  "id" TEXT NOT NULL, "definitionId" TEXT NOT NULL, "status" "MarketDatasetImportStatus" NOT NULL DEFAULT 'QUEUED',
  "contentHash" TEXT, "sourceUrl" TEXT NOT NULL, "sourceEffectiveAt" TIMESTAMP(3), "retrievedAt" TIMESTAMP(3),
  "rowCount" INTEGER NOT NULL DEFAULT 0, "schemaSnapshot" JSONB, "errorCode" TEXT, "errorMessage" TEXT,
  "nextEligibleAt" TIMESTAMP(3), "attemptCount" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3), CONSTRAINT "MarketDatasetImport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketDatasetImport_counts_check" CHECK ("rowCount" >= 0 AND "attemptCount" BETWEEN 0 AND 5)
);

CREATE TABLE "MarketObservation" (
  "id" TEXT NOT NULL, "definitionId" TEXT NOT NULL, "importId" TEXT NOT NULL, "geographyType" TEXT NOT NULL,
  "regionId" TEXT NOT NULL, "regionName" TEXT NOT NULL, "period" TIMESTAMP(3) NOT NULL, "value" DECIMAL(65,30) NOT NULL,
  "unit" TEXT NOT NULL, "sourceRevision" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyDiscoveryReference" (
  "id" TEXT NOT NULL, "propertyId" TEXT, "providerKey" TEXT NOT NULL, "originalUrl" TEXT NOT NULL, "normalizedUrl" TEXT NOT NULL,
  "status" "DiscoveryReferenceStatus" NOT NULL DEFAULT 'SUBMITTED', "submittedBy" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "observedAddress" TEXT, "observedAskingPrice" DECIMAL(65,30),
  "observedAvailability" TEXT, "observationNotes" TEXT, "verificationStatus" TEXT NOT NULL DEFAULT 'USER_OBSERVED_UNVERIFIED',
  "lastComparedAt" TIMESTAMP(3), "conflictSummary" JSONB, CONSTRAINT "PropertyDiscoveryReference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyDiscoveryReference_provider_check" CHECK ("providerKey" = 'ZILLOW'),
  CONSTRAINT "PropertyDiscoveryReference_verification_check" CHECK ("verificationStatus" = 'USER_OBSERVED_UNVERIFIED'),
  CONSTRAINT "PropertyDiscoveryReference_price_check" CHECK ("observedAskingPrice" IS NULL OR "observedAskingPrice" >= 0)
);

CREATE UNIQUE INDEX "ExternalProvider_key_key" ON "ExternalProvider"("key");
CREATE INDEX "ExternalProvider_status_nextEligibleAt_idx" ON "ExternalProvider"("status", "nextEligibleAt");
CREATE INDEX "ExternalProvider_circuitOpenUntil_idx" ON "ExternalProvider"("circuitOpenUntil");
CREATE UNIQUE INDEX "ProviderJobCheckpoint_providerId_workType_key" ON "ProviderJobCheckpoint"("providerId", "workType");
CREATE INDEX "ProviderJobCheckpoint_nextEligibleAt_idx" ON "ProviderJobCheckpoint"("nextEligibleAt");
CREATE UNIQUE INDEX "MarketDatasetDefinition_key_key" ON "MarketDatasetDefinition"("key");
CREATE INDEX "MarketDatasetDefinition_providerId_enabled_idx" ON "MarketDatasetDefinition"("providerId", "enabled");
CREATE UNIQUE INDEX "MarketDatasetImport_definitionId_contentHash_key" ON "MarketDatasetImport"("definitionId", "contentHash");
CREATE INDEX "MarketDatasetImport_status_nextEligibleAt_idx" ON "MarketDatasetImport"("status", "nextEligibleAt");
CREATE INDEX "MarketDatasetImport_definitionId_createdAt_idx" ON "MarketDatasetImport"("definitionId", "createdAt");
CREATE UNIQUE INDEX "MarketObservation_importId_regionId_period_key" ON "MarketObservation"("importId", "regionId", "period");
CREATE INDEX "MarketObservation_definitionId_regionId_period_idx" ON "MarketObservation"("definitionId", "regionId", "period");
CREATE UNIQUE INDEX "PropertyDiscoveryReference_normalizedUrl_key" ON "PropertyDiscoveryReference"("normalizedUrl");
CREATE INDEX "PropertyDiscoveryReference_propertyId_submittedAt_idx" ON "PropertyDiscoveryReference"("propertyId", "submittedAt");
CREATE INDEX "PropertyDiscoveryReference_providerKey_status_submittedAt_idx" ON "PropertyDiscoveryReference"("providerKey", "status", "submittedAt");

ALTER TABLE "ProviderJobCheckpoint" ADD CONSTRAINT "ProviderJobCheckpoint_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ExternalProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketDatasetDefinition" ADD CONSTRAINT "MarketDatasetDefinition_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ExternalProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketDatasetImport" ADD CONSTRAINT "MarketDatasetImport_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "MarketDatasetDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketObservation" ADD CONSTRAINT "MarketObservation_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "MarketDatasetDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketObservation" ADD CONSTRAINT "MarketObservation_importId_fkey" FOREIGN KEY ("importId") REFERENCES "MarketDatasetImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyDiscoveryReference" ADD CONSTRAINT "PropertyDiscoveryReference_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
