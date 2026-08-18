CREATE TABLE "DeveloperResearchRun" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourcesChecked" INTEGER NOT NULL DEFAULT 0,
    "findingsFound" INTEGER NOT NULL DEFAULT 0,
    "manualNeeded" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "DeveloperResearchRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeveloperResearchRun_developerId_startedAt_idx" ON "DeveloperResearchRun"("developerId", "startedAt");
CREATE INDEX "DeveloperResearchRun_status_startedAt_idx" ON "DeveloperResearchRun"("status", "startedAt");
ALTER TABLE "DeveloperResearchRun" ADD CONSTRAINT "DeveloperResearchRun_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PropertyResearchRun" ("id", "propertyId", "status", "startedAt")
SELECT 'backfill_property_' || md5(p."id"), p."id", 'QUEUED', CURRENT_TIMESTAMP
FROM "Property" p
WHERE p."opportunityStatus" <> 'REJECTED'
  AND NOT EXISTS (
    SELECT 1 FROM "PropertyResearchRun" r
    WHERE r."propertyId" = p."id" AND r."status" IN ('QUEUED', 'RUNNING')
  );

INSERT INTO "DeveloperResearchRun" ("id", "developerId", "status", "startedAt")
SELECT 'backfill_developer_' || md5(d."id"), d."id", 'QUEUED', CURRENT_TIMESTAMP
FROM "Developer" d
WHERE d."active" = true;
