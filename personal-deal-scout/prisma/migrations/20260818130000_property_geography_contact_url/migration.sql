ALTER TABLE "Property"
ADD COLUMN "county" TEXT,
ADD COLUMN "neighborhood" TEXT,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "contactUrl" TEXT;

CREATE INDEX "Property_state_county_idx" ON "Property"("state", "county");
