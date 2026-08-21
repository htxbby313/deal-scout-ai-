ALTER TABLE "PropertyResearchRun"
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "exhausted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "DeveloperResearchRun"
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "exhausted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MessageApproval"
ADD COLUMN "blockerCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "PropertyResearchRun"
ADD CONSTRAINT "PropertyResearchRun_attempts_check"
CHECK ("attemptCount" >= 0 AND "maxAttempts" BETWEEN 1 AND 10 AND "attemptCount" <= "maxAttempts");

ALTER TABLE "DeveloperResearchRun"
ADD CONSTRAINT "DeveloperResearchRun_attempts_check"
CHECK ("attemptCount" >= 0 AND "maxAttempts" BETWEEN 1 AND 10 AND "attemptCount" <= "maxAttempts");
