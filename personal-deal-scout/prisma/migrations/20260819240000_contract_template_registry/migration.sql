CREATE TYPE "ContractTemplateType" AS ENUM ('PURCHASE_AGREEMENT','ASSIGNMENT_AGREEMENT','EQUITABLE_INTEREST_DISCLOSURE','SELLER_ACKNOWLEDGMENT','BUYER_ACKNOWLEDGMENT','DUE_DILIGENCE_NOTICE','TERMINATION_NOTICE','CLOSING_INSTRUCTIONS','OTHER');
CREATE TYPE "ContractTemplateStatus" AS ENUM ('INACTIVE_PLACEHOLDER','REVIEW_PENDING','ACTIVE','REJECTED','SUPERSEDED');
CREATE TABLE "ContractTemplateVersion" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ContractTemplateType" NOT NULL,
  "jurisdictionState" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "ContractTemplateStatus" NOT NULL DEFAULT 'INACTIVE_PLACEHOLDER',
  "artifactHash" TEXT,
  "storageKey" TEXT,
  "sourceUrl" TEXT,
  "userSuppliedBy" TEXT,
  "userSuppliedAt" TIMESTAMP(3),
  "counselReviewer" TEXT,
  "counselApprovedAt" TIMESTAMP(3),
  "counselApprovalEvidenceUrl" TEXT,
  "ownerApprovedBy" TEXT,
  "ownerApprovedAt" TIMESTAMP(3),
  "ownerApprovalReason" TEXT,
  "effectiveAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  CONSTRAINT "ContractTemplateVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContractTemplateVersion_jurisdictionState_type_version_key" ON "ContractTemplateVersion"("jurisdictionState","type","version");
CREATE INDEX "ContractTemplateVersion_jurisdictionState_type_status_idx" ON "ContractTemplateVersion"("jurisdictionState","type","status");
CREATE UNIQUE INDEX "ContractTemplateVersion_one_active_per_scope" ON "ContractTemplateVersion"("jurisdictionState","type") WHERE "status" = 'ACTIVE';
CREATE OR REPLACE FUNCTION protect_active_contract_template() RETURNS trigger AS $$ BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'ACTIVE' THEN RAISE EXCEPTION 'Active contract template versions cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" = 'ACTIVE' AND (NEW."status" <> 'SUPERSEDED' OR NEW."artifactHash" IS DISTINCT FROM OLD."artifactHash" OR NEW."storageKey" IS DISTINCT FROM OLD."storageKey" OR NEW."sourceUrl" IS DISTINCT FROM OLD."sourceUrl" OR NEW."jurisdictionState" IS DISTINCT FROM OLD."jurisdictionState" OR NEW."type" IS DISTINCT FROM OLD."type" OR NEW."version" IS DISTINCT FROM OLD."version") THEN RAISE EXCEPTION 'Active contract template artifacts are immutable'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "ContractTemplateVersion_active_immutable" BEFORE UPDATE OR DELETE ON "ContractTemplateVersion" FOR EACH ROW EXECUTE FUNCTION protect_active_contract_template();
