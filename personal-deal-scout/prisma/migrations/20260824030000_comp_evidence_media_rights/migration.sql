CREATE TYPE "MediaRightsStatus" AS ENUM ('OWNED', 'LICENSED', 'PERMISSION_DOCUMENTED', 'INTERNAL_ONLY', 'EXTERNAL_APPROVED', 'LINK_ONLY', 'UNKNOWN', 'RESTRICTED', 'REJECTED');

ALTER TABLE "PropertyMedia"
ADD COLUMN "rightsStatus" "MediaRightsStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "rightsEvidenceUrl" TEXT,
ADD COLUMN "externalApprovedAt" TIMESTAMP(3);

CREATE TABLE "ComparableSale" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "distanceMiles" DECIMAL(8,3) NOT NULL,
  "soldDate" TIMESTAMP(3) NOT NULL,
  "soldPriceCents" BIGINT NOT NULL,
  "propertyType" TEXT,
  "bedrooms" DECIMAL(4,1),
  "bathrooms" DECIMAL(4,1),
  "squareFeet" INTEGER,
  "lotSquareFeet" INTEGER,
  "yearBuilt" INTEGER,
  "condition" TEXT,
  "sourceUrl" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "verificationStatus" TEXT NOT NULL DEFAULT 'VERIFIED_PUBLIC_RECORD',
  "confidence" INTEGER NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComparableSale_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ComparableSale_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ComparableSale_confidence_check" CHECK ("confidence" BETWEEN 0 AND 100),
  CONSTRAINT "ComparableSale_sold_price_check" CHECK ("soldPriceCents" > 0),
  CONSTRAINT "ComparableSale_distance_check" CHECK ("distanceMiles" >= 0)
);

CREATE UNIQUE INDEX "ComparableSale_propertyId_address_soldDate_sourceUrl_key" ON "ComparableSale"("propertyId", "address", "soldDate", "sourceUrl");
CREATE INDEX "ComparableSale_propertyId_soldDate_distanceMiles_idx" ON "ComparableSale"("propertyId", "soldDate", "distanceMiles");
