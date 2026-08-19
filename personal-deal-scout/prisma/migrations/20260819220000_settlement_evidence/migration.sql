CREATE TABLE "SettlementArtifact" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "artifactHash" TEXT NOT NULL,
  "storageKey" TEXT,
  "sourceUrl" TEXT,
  "reviewer" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL,
  "closingDate" TIMESTAMP(3) NOT NULL,
  "sellerProceeds" INTEGER,
  "assignmentFee" INTEGER,
  "transactionCosts" INTEGER,
  "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementArtifact_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SettlementCorrection" (
  "id" TEXT NOT NULL,
  "settlementArtifactId" TEXT NOT NULL,
  "correctedFields" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "reviewer" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementCorrection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SettlementArtifact_artifactHash_key" ON "SettlementArtifact"("artifactHash");
CREATE INDEX "SettlementArtifact_transactionId_closingDate_idx" ON "SettlementArtifact"("transactionId","closingDate");
CREATE INDEX "SettlementCorrection_settlementArtifactId_createdAt_idx" ON "SettlementCorrection"("settlementArtifactId","createdAt");
ALTER TABLE "SettlementArtifact" ADD CONSTRAINT "SettlementArtifact_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "DealTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementCorrection" ADD CONSTRAINT "SettlementCorrection_settlementArtifactId_fkey" FOREIGN KEY ("settlementArtifactId") REFERENCES "SettlementArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE OR REPLACE FUNCTION prevent_settlement_evidence_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Settlement evidence is immutable; add a correction instead'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "SettlementArtifact_immutable" BEFORE UPDATE OR DELETE ON "SettlementArtifact" FOR EACH ROW EXECUTE FUNCTION prevent_settlement_evidence_mutation();
CREATE TRIGGER "SettlementCorrection_immutable" BEFORE UPDATE OR DELETE ON "SettlementCorrection" FOR EACH ROW EXECUTE FUNCTION prevent_settlement_evidence_mutation();
