ALTER TABLE "AgentTask" ADD COLUMN "dedupeKey" TEXT;
UPDATE "AgentTask" SET "dedupeKey" = "id" WHERE "dedupeKey" IS NULL;
ALTER TABLE "AgentTask" ALTER COLUMN "dedupeKey" SET NOT NULL;
CREATE UNIQUE INDEX "AgentTask_dedupeKey_key" ON "AgentTask"("dedupeKey");
