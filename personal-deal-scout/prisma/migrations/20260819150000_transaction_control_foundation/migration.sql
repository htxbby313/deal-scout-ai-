CREATE TYPE "DealTransactionStatus" AS ENUM ('DRAFT', 'RESEARCH', 'DUE_DILIGENCE', 'OFFER_PENDING', 'UNDER_CONTRACT', 'BUYER_MATCHING', 'ASSIGNMENT_PENDING', 'CLOSING_PENDING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TransactionControlStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'STOPPED');
CREATE TYPE "TransactionApprovalType" AS ENUM ('SELLER_CONTACT', 'BUYER_CONTACT', 'OFFER', 'CONTRACT', 'ASSIGNMENT_MARKETING', 'ASSIGNMENT', 'EARNEST_MONEY', 'CLOSING_INSTRUCTION', 'PHOTO_REDISTRIBUTION', 'OTHER');
CREATE TYPE "TransactionApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');
CREATE TYPE "TransactionDocumentStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'EXECUTED', 'VOIDED');

CREATE TABLE "DealTransaction" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "leadId" TEXT,
  "developerId" TEXT,
  "status" "DealTransactionStatus" NOT NULL DEFAULT 'DRAFT',
  "controlStatus" "TransactionControlStatus" NOT NULL DEFAULT 'ON_HOLD',
  "ownerHoldReason" TEXT,
  "ownerHoldAt" TIMESTAMP(3),
  "ownerStoppedAt" TIMESTAMP(3),
  "targetSellerPrice" INTEGER,
  "targetBuyerPrice" INTEGER,
  "targetAssignmentFee" INTEGER,
  "jurisdictionState" TEXT NOT NULL,
  "counselApprovedAt" TIMESTAMP(3),
  "complianceVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DealTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransactionDocument" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "TransactionDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "storageKey" TEXT,
  "sourceUrl" TEXT,
  "contentHash" TEXT,
  "counselApproved" BOOLEAN NOT NULL DEFAULT false,
  "executedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransactionDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransactionApproval" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "type" "TransactionApprovalType" NOT NULL,
  "status" "TransactionApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "requestedBy" TEXT NOT NULL,
  "decidedBy" TEXT,
  "reason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "TransactionApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransactionAuditEvent" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "details" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DealTransaction_status_controlStatus_idx" ON "DealTransaction"("status", "controlStatus");
CREATE INDEX "DealTransaction_propertyId_createdAt_idx" ON "DealTransaction"("propertyId", "createdAt");
CREATE INDEX "DealTransaction_developerId_idx" ON "DealTransaction"("developerId");
CREATE UNIQUE INDEX "TransactionDocument_transactionId_type_version_key" ON "TransactionDocument"("transactionId", "type", "version");
CREATE INDEX "TransactionDocument_transactionId_status_idx" ON "TransactionDocument"("transactionId", "status");
CREATE INDEX "TransactionApproval_transactionId_type_status_idx" ON "TransactionApproval"("transactionId", "type", "status");
CREATE UNIQUE INDEX "TransactionAuditEvent_transactionId_sequence_key" ON "TransactionAuditEvent"("transactionId", "sequence");
CREATE INDEX "TransactionAuditEvent_transactionId_occurredAt_idx" ON "TransactionAuditEvent"("transactionId", "occurredAt");

ALTER TABLE "DealTransaction" ADD CONSTRAINT "DealTransaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DealTransaction" ADD CONSTRAINT "DealTransaction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DealTransaction" ADD CONSTRAINT "DealTransaction_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransactionDocument" ADD CONSTRAINT "TransactionDocument_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "DealTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionApproval" ADD CONSTRAINT "TransactionApproval_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "DealTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionAuditEvent" ADD CONSTRAINT "TransactionAuditEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "DealTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_transaction_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Transaction audit events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TransactionAuditEvent_append_only"
BEFORE UPDATE OR DELETE ON "TransactionAuditEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_transaction_audit_mutation();
