ALTER TABLE "Property" ADD COLUMN "marketFips" TEXT;
CREATE INDEX "Property_marketFips_idx" ON "Property"("marketFips");
