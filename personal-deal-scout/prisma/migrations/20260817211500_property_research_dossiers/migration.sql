CREATE TYPE "ResearchFindingStatus" AS ENUM ('VERIFIED', 'NOT_FOUND', 'CONFLICT', 'NEEDS_MANUAL_VERIFICATION');
CREATE TYPE "PropertyMediaKind" AS ENUM ('LISTING_PHOTO', 'MAP', 'PARCEL', 'DOCUMENT', 'OTHER');

CREATE TABLE "PropertyResearchRun" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "sourcesChecked" INTEGER NOT NULL DEFAULT 0,
  "findingsFound" INTEGER NOT NULL DEFAULT 0,
  "manualNeeded" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "PropertyResearchRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyResearchFinding" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT,
  "status" "ResearchFindingStatus" NOT NULL,
  "sourceName" TEXT,
  "sourceUrl" TEXT,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confidence" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  CONSTRAINT "PropertyResearchFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyMedia" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "caption" TEXT,
  "altText" TEXT NOT NULL,
  "kind" "PropertyMediaKind" NOT NULL DEFAULT 'LISTING_PHOTO',
  "position" INTEGER NOT NULL DEFAULT 0,
  "sendApproved" BOOLEAN NOT NULL DEFAULT false,
  "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "PropertyMedia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropertyResearchFinding_propertyId_topic_key" ON "PropertyResearchFinding"("propertyId", "topic");
CREATE INDEX "PropertyResearchFinding_propertyId_status_idx" ON "PropertyResearchFinding"("propertyId", "status");
CREATE INDEX "PropertyResearchRun_propertyId_startedAt_idx" ON "PropertyResearchRun"("propertyId", "startedAt");
CREATE UNIQUE INDEX "PropertyMedia_propertyId_url_key" ON "PropertyMedia"("propertyId", "url");
CREATE INDEX "PropertyMedia_propertyId_position_idx" ON "PropertyMedia"("propertyId", "position");
ALTER TABLE "PropertyResearchRun" ADD CONSTRAINT "PropertyResearchRun_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyResearchFinding" ADD CONSTRAINT "PropertyResearchFinding_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
