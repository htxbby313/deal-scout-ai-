CREATE INDEX "Property_opportunityStatus_updatedAt_idx" ON "Property"("opportunityStatus", "updatedAt");
CREATE INDEX "PropertyResearchRun_status_startedAt_idx" ON "PropertyResearchRun"("status", "startedAt");
CREATE INDEX "PropertyResearchRun_propertyId_status_idx" ON "PropertyResearchRun"("propertyId", "status");
CREATE INDEX "Lead_status_priority_updatedAt_idx" ON "Lead"("status", "priority", "updatedAt");
CREATE INDEX "Developer_active_updatedAt_idx" ON "Developer"("active", "updatedAt");
CREATE INDEX "DeveloperResearchRun_developerId_status_idx" ON "DeveloperResearchRun"("developerId", "status");
CREATE INDEX "GovernmentResearchRun_source_period_status_finishedAt_idx" ON "GovernmentResearchRun"("source", "period", "status", "finishedAt");
