ALTER TABLE "Property" ADD COLUMN "propertyType" TEXT;
ALTER TABLE "Property" ADD COLUMN "leadSource" TEXT;
ALTER TABLE "DealTransaction" ADD COLUMN "transactionStructure" TEXT;
CREATE INDEX "Property_propertyType_leadSource_idx" ON "Property"("propertyType","leadSource");
CREATE INDEX "DealTransaction_transactionStructure_idx" ON "DealTransaction"("transactionStructure");
