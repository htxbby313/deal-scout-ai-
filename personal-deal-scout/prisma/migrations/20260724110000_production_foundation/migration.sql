CREATE TYPE "SystemMode" AS ENUM ('RESEARCH', 'ACTIVE', 'PAUSED');

CREATE TABLE "Property" ("id" TEXT PRIMARY KEY, "address" TEXT NOT NULL, "city" TEXT NOT NULL, "state" TEXT NOT NULL, "zipCode" TEXT NOT NULL, "ownerName" TEXT NOT NULL, "yearBuilt" TEXT, "lotSize" TEXT, "estimatedValue" INTEGER, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "Property_address_zipCode_key" ON "Property"("address", "zipCode");
CREATE TABLE "Lead" ("id" TEXT PRIMARY KEY, "propertyId" TEXT NOT NULL, "ownerName" TEXT NOT NULL, "status" TEXT NOT NULL, "priority" TEXT NOT NULL, "nextActionType" TEXT NOT NULL, "nextActionAt" TEXT NOT NULL, "estimatedAssignmentFee" INTEGER NOT NULL DEFAULT 0, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "Lead_propertyId_key" ON "Lead"("propertyId");
CREATE TABLE "Task" ("id" TEXT PRIMARY KEY, "leadId" TEXT NOT NULL, "title" TEXT NOT NULL, "type" TEXT NOT NULL, "priority" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN', "dueAt" TEXT NOT NULL, "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "Task_leadId_title_key" ON "Task"("leadId", "title");
CREATE TABLE "Developer" ("id" TEXT PRIMARY KEY, "companyName" TEXT NOT NULL, "contactName" TEXT, "phone" TEXT, "email" TEXT, "website" TEXT, "targetZipCodes" TEXT[], "maximumPurchasePrice" INTEGER, "typicalBuildPrice" INTEGER, "notes" TEXT, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "Developer_companyName_key" ON "Developer"("companyName");
CREATE TABLE "DeveloperProject" ("id" TEXT PRIMARY KEY, "developerId" TEXT NOT NULL, "address" TEXT NOT NULL, "city" TEXT NOT NULL, "state" TEXT NOT NULL, "zipCode" TEXT NOT NULL, "originalPurchasePrice" INTEGER, "newBuildSalePrice" INTEGER, "lotSquareFeet" INTEGER, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "DeveloperProject_developerId_address_zipCode_key" ON "DeveloperProject"("developerId", "address", "zipCode");
CREATE TABLE "MessageTemplate" ("id" TEXT PRIMARY KEY, "type" TEXT NOT NULL, "channel" TEXT NOT NULL, "body" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "MessageTemplate_type_channel_key" ON "MessageTemplate"("type", "channel");
CREATE TABLE "MessageApproval" ("id" TEXT PRIMARY KEY, "leadId" TEXT, "templateId" TEXT, "channel" TEXT NOT NULL, "recipientLabel" TEXT NOT NULL, "subject" TEXT, "body" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "provider" TEXT NOT NULL DEFAULT 'disabled', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "AuditLog" ("id" TEXT PRIMARY KEY, "type" TEXT NOT NULL, "summary" TEXT NOT NULL, "details" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE TABLE "ProviderSetting" ("id" TEXT PRIMARY KEY, "provider" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT false, "configured" BOOLEAN NOT NULL DEFAULT false, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "ProviderSetting_provider_key" ON "ProviderSetting"("provider");
CREATE TABLE "SystemSetting" ("id" TEXT PRIMARY KEY DEFAULT 'singleton', "mode" "SystemMode" NOT NULL DEFAULT 'RESEARCH', "migrationVersion" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "DeveloperMatch" ("id" TEXT PRIMARY KEY, "propertyId" TEXT NOT NULL, "developerId" TEXT NOT NULL, "score" INTEGER NOT NULL, "reasons" TEXT[], "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "DeveloperMatch_propertyId_developerId_key" ON "DeveloperMatch"("propertyId", "developerId");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE;
ALTER TABLE "DeveloperProject" ADD CONSTRAINT "DeveloperProject_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE;
ALTER TABLE "MessageApproval" ADD CONSTRAINT "MessageApproval_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL;
ALTER TABLE "DeveloperMatch" ADD CONSTRAINT "DeveloperMatch_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE;
ALTER TABLE "DeveloperMatch" ADD CONSTRAINT "DeveloperMatch_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE;
