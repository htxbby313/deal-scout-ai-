ALTER TABLE "AcquisitionStagePolicy" ADD COLUMN "entryCriteria" JSONB;
ALTER TABLE "AcquisitionStagePolicy" ADD COLUMN "exitCriteria" JSONB;
ALTER TABLE "AcquisitionStagePolicy" ADD COLUMN "activatedBy" TEXT;
ALTER TABLE "AcquisitionStagePolicy" ADD COLUMN "activatedAt" TIMESTAMP(3);
