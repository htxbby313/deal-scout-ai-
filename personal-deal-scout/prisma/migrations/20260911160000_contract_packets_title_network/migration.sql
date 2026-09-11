CREATE TYPE "ContractPacketStructure" AS ENUM ('ASSIGNMENT', 'DOUBLE_CLOSE', 'DIRECT_PURCHASE');
CREATE TYPE "TitleCompanyStatus" AS ENUM ('UNCONTACTED', 'CONTACTED', 'VERIFIED', 'USED_SUCCESSFULLY', 'PREFERRED', 'INACTIVE');
CREATE TYPE "TitleCompanyPriority" AS ENUM ('PRIMARY', 'BACKUP', 'UNASSIGNED');
CREATE TYPE "TitleOpeningStatus" AS ENUM ('PREPARING', 'OPENED', 'TITLE_REVIEW', 'CURATIVE', 'CLEAR_TO_CLOSE', 'CLOSED', 'CANCELLED');

CREATE TABLE "TitleCompany" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "website" TEXT, "status" "TitleCompanyStatus" NOT NULL DEFAULT 'UNCONTACTED',
  "priority" "TitleCompanyPriority" NOT NULL DEFAULT 'UNASSIGNED', "serviceAreas" TEXT[], "counties" TEXT[],
  "assignmentAcceptance" BOOLEAN, "doubleCloseCapability" BOOLEAN, "transactionalFundingCoordination" BOOLEAN, "eClosing" BOOLEAN,
  "earnestMoneyInstructions" TEXT, "typicalTurnaround" TEXT, "requiredDocuments" TEXT[], "notes" TEXT, "verifiedAt" TIMESTAMP(3), "verifiedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TitleCompany_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TitleCompany_name_key" ON "TitleCompany"("name");
CREATE INDEX "TitleCompany_status_priority_idx" ON "TitleCompany"("status", "priority");

CREATE TABLE "TitleCompanyContact" (
  "id" TEXT NOT NULL, "titleCompanyId" TEXT NOT NULL, "name" TEXT NOT NULL, "role" TEXT, "email" TEXT, "phone" TEXT, "office" TEXT,
  "primary" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TitleCompanyContact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TitleCompanyContact_titleCompanyId_primary_idx" ON "TitleCompanyContact"("titleCompanyId", "primary");

CREATE TABLE "TitleOpening" (
  "id" TEXT NOT NULL, "transactionId" TEXT NOT NULL, "titleCompanyId" TEXT NOT NULL, "status" "TitleOpeningStatus" NOT NULL DEFAULT 'PREPARING',
  "fileNumber" TEXT, "escrowOfficer" TEXT, "openedAt" TIMESTAMP(3), "targetCloseAt" TIMESTAMP(3), "earnestMoneyDueAt" TIMESTAMP(3),
  "requirements" TEXT[], "notes" TEXT, "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TitleOpening_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TitleOpening_transactionId_status_idx" ON "TitleOpening"("transactionId", "status");
CREATE INDEX "TitleOpening_titleCompanyId_status_idx" ON "TitleOpening"("titleCompanyId", "status");

CREATE TABLE "ContractPacket" (
  "id" TEXT NOT NULL, "transactionId" TEXT NOT NULL, "structure" "ContractPacketStructure" NOT NULL, "status" "TransactionDocumentStatus" NOT NULL DEFAULT 'DRAFT', "version" INTEGER NOT NULL DEFAULT 1,
  "effectiveDate" TIMESTAMP(3), "closingDate" TIMESTAMP(3) NOT NULL, "feasibilityDays" INTEGER NOT NULL, "accessNoticeHours" INTEGER NOT NULL,
  "earnestMoneyCents" BIGINT NOT NULL, "feasibilityFeeCents" BIGINT NOT NULL, "purchasePriceCents" BIGINT NOT NULL, "assignmentFeeCents" BIGINT,
  "assignmentDepositCents" BIGINT, "assigneeDiligenceDeadline" TIMESTAMP(3), "proofOfFundsDueAt" TIMESTAMP(3), "sellerLegalName" TEXT NOT NULL,
  "buyerLegalName" TEXT NOT NULL, "assigneeLegalName" TEXT, "legalDescription" TEXT NOT NULL, "propertyType" TEXT NOT NULL, "costAllocation" TEXT NOT NULL,
  "sellerNoticeInformation" TEXT NOT NULL, "buyerNoticeInformation" TEXT NOT NULL, "brokerDisclosure" TEXT NOT NULL, "assignmentContingency" TEXT,
  "titleCompanyId" TEXT, "purchaseAgreement" TEXT NOT NULL, "assignmentAgreement" TEXT, "equitableInterestDisclosure" TEXT NOT NULL,
  "generatedBy" TEXT NOT NULL, "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractPacket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContractPacket_transactionId_version_key" ON "ContractPacket"("transactionId", "version");
CREATE INDEX "ContractPacket_transactionId_status_idx" ON "ContractPacket"("transactionId", "status");
CREATE INDEX "ContractPacket_titleCompanyId_idx" ON "ContractPacket"("titleCompanyId");

ALTER TABLE "TitleCompanyContact" ADD CONSTRAINT "TitleCompanyContact_titleCompanyId_fkey" FOREIGN KEY ("titleCompanyId") REFERENCES "TitleCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TitleOpening" ADD CONSTRAINT "TitleOpening_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "DealTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TitleOpening" ADD CONSTRAINT "TitleOpening_titleCompanyId_fkey" FOREIGN KEY ("titleCompanyId") REFERENCES "TitleCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractPacket" ADD CONSTRAINT "ContractPacket_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "DealTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractPacket" ADD CONSTRAINT "ContractPacket_titleCompanyId_fkey" FOREIGN KEY ("titleCompanyId") REFERENCES "TitleCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
