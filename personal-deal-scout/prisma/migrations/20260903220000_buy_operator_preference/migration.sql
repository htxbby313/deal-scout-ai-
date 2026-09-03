-- Operator Buy Boxes are query definitions, not a lead ledger.
-- Matches become Property + AcquisitionFunnel rows (Deals), never a search silo.
CREATE TABLE "BuyOperatorPreference" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL DEFAULT 'owner',
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "naturalLanguage" TEXT,
    "states" TEXT[],
    "cities" TEXT[],
    "counties" TEXT[],
    "zipCodes" TEXT[],
    "propertyTypes" TEXT[],
    "minPriceCents" BIGINT,
    "maxPriceCents" BIGINT,
    "minSpreadCents" BIGINT,
    "maxRepairCents" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyOperatorPreference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BuyOperatorPreference_ownerId_active_idx" ON "BuyOperatorPreference"("ownerId", "active");
