ALTER TABLE "TransactionOutcome" ADD COLUMN "reasonCode" TEXT;
ALTER TABLE "TransactionOutcome" ADD COLUMN "reasonExplanation" TEXT;
CREATE INDEX "TransactionOutcome_reasonCode_finalizedAt_idx" ON "TransactionOutcome"("reasonCode", "finalizedAt");
