CREATE INDEX "AcquisitionFunnel_stage_updatedAt_idx"
ON "AcquisitionFunnel"("stage", "updatedAt");

CREATE INDEX "AcquisitionFunnel_stage_nextReviewAt_idx"
ON "AcquisitionFunnel"("stage", "nextReviewAt");
