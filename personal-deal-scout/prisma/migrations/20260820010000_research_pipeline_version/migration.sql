ALTER TABLE "PropertyResearchRun"
ADD COLUMN "researchVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "DeveloperResearchRun"
ADD COLUMN "researchVersion" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "PropertyResearchRun_propertyId_researchVersion_idx"
ON "PropertyResearchRun"("propertyId", "researchVersion");

CREATE INDEX "DeveloperResearchRun_developerId_researchVersion_idx"
ON "DeveloperResearchRun"("developerId", "researchVersion");
