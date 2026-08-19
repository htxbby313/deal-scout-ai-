CREATE TABLE "FinancialProjection" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sellerContractPriceCents" BIGINT NOT NULL,
    "sellerAskingPriceCents" BIGINT,
    "sellerMinimumNetCents" BIGINT,
    "buyerPriceLowCents" BIGINT NOT NULL,
    "buyerPriceBaseCents" BIGINT NOT NULL,
    "buyerPriceHighCents" BIGINT NOT NULL,
    "buyerPriceStatus" TEXT NOT NULL,
    "buyerPriceSourceUrl" TEXT NOT NULL,
    "buyerPriceObservedAt" TIMESTAMP(3) NOT NULL,
    "buyerPriceExpiresAt" TIMESTAMP(3) NOT NULL,
    "transactionCostsCents" BIGINT NOT NULL,
    "doubleClosingCostsCents" BIGINT NOT NULL,
    "titleExpensesCents" BIGINT NOT NULL,
    "closingExpensesCents" BIGINT NOT NULL,
    "transactionalFundingCents" BIGINT NOT NULL,
    "financingCostsCents" BIGINT NOT NULL,
    "taxesCents" BIGINT NOT NULL,
    "liensAndPayoffsCents" BIGINT NOT NULL,
    "concessionsCents" BIGINT NOT NULL,
    "inspectionExpensesCents" BIGINT NOT NULL,
    "legalExpensesCents" BIGINT NOT NULL,
    "dataMarketingCostsCents" BIGINT NOT NULL,
    "insuranceExpensesCents" BIGINT NOT NULL,
    "otherExpensesCents" BIGINT NOT NULL,
    "riskReserveCents" BIGINT NOT NULL,
    "contingencyReserveCents" BIGINT NOT NULL,
    "earnestMoneyDepositedCents" BIGINT NOT NULL,
    "earnestMoneyAtRiskCents" BIGINT NOT NULL,
    "probabilityLowBps" INTEGER NOT NULL,
    "probabilityBaseBps" INTEGER NOT NULL,
    "probabilityHighBps" INTEGER NOT NULL,
    "feeLowCents" BIGINT NOT NULL,
    "feeBaseCents" BIGINT NOT NULL,
    "feeHighCents" BIGINT NOT NULL,
    "probabilityWeightedCents" BIGINT NOT NULL,
    "sellerSafeMaximumCents" BIGINT NOT NULL,
    "targetFeeLowCents" BIGINT NOT NULL,
    "targetFeeHighCents" BIGINT NOT NULL,
    "evidence" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "correctionReason" TEXT,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialProjection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementReview" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "settlementDocumentUrl" TEXT NOT NULL,
    "settlementDocumentHash" TEXT NOT NULL,
    "grossAssignmentFeeCents" BIGINT NOT NULL,
    "actualExpensesCents" BIGINT NOT NULL,
    "realizedProfitCents" BIGINT NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "correctionReason" TEXT,
    "correctsId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SettlementReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialProjection_transactionId_version_key" ON "FinancialProjection"("transactionId", "version");
CREATE INDEX "FinancialProjection_transactionId_createdAt_idx" ON "FinancialProjection"("transactionId", "createdAt");
CREATE INDEX "FinancialProjection_supersedesId_idx" ON "FinancialProjection"("supersedesId");
CREATE UNIQUE INDEX "SettlementReview_transactionId_version_key" ON "SettlementReview"("transactionId", "version");
CREATE UNIQUE INDEX "SettlementReview_transactionId_settlementDocumentHash_version_key" ON "SettlementReview"("transactionId", "settlementDocumentHash", "version");
CREATE INDEX "SettlementReview_transactionId_reviewedAt_idx" ON "SettlementReview"("transactionId", "reviewedAt");
CREATE INDEX "SettlementReview_correctsId_idx" ON "SettlementReview"("correctsId");

ALTER TABLE "FinancialProjection" ADD CONSTRAINT "FinancialProjection_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "DealTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialProjection" ADD CONSTRAINT "FinancialProjection_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "FinancialProjection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementReview" ADD CONSTRAINT "SettlementReview_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "DealTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementReview" ADD CONSTRAINT "SettlementReview_correctsId_fkey" FOREIGN KEY ("correctsId") REFERENCES "SettlementReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
