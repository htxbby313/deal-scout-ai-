CREATE TYPE "QualificationStatus" AS ENUM ('RESEARCH_NEEDED', 'LIMITED_CONTACT', 'QUALIFIED', 'PRIORITY', 'REJECTED');
CREATE TYPE "OpportunityStatus" AS ENUM ('NEEDS_VERIFICATION', 'DEVELOPMENT_SIGNAL', 'CONFIRMED_AVAILABLE', 'GOVERNMENT_SALE', 'REJECTED');

ALTER TABLE "Developer"
ADD COLUMN "qualificationStatus" "QualificationStatus" NOT NULL DEFAULT 'RESEARCH_NEEDED',
ADD COLUMN "contactVerifiedAt" TIMESTAMP(3),
ADD COLUMN "lastResearchedAt" TIMESTAMP(3);

ALTER TABLE "DeveloperProject"
ADD COLUMN "sourceName" TEXT,
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "sourceRecordDate" TEXT,
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "confidence" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Property"
ADD COLUMN "opportunityStatus" "OpportunityStatus" NOT NULL DEFAULT 'NEEDS_VERIFICATION',
ADD COLUMN "contactName" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "sourceName" TEXT,
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "sourceRecordDate" TEXT,
ADD COLUMN "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN "confidence" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Developer_qualificationStatus_idx" ON "Developer"("qualificationStatus");
CREATE INDEX "Property_opportunityStatus_idx" ON "Property"("opportunityStatus");
