CREATE TABLE "ProviderWebhookReceipt" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "channel" "EngagementChannel" NOT NULL,
  "externalEventId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "byteLength" INTEGER NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderWebhookReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderWebhookReceipt_byteLength_check" CHECK ("byteLength" >= 0)
);
CREATE UNIQUE INDEX "ProviderWebhookReceipt_provider_channel_externalEventId_key" ON "ProviderWebhookReceipt"("provider", "channel", "externalEventId");
CREATE INDEX "ProviderWebhookReceipt_channel_receivedAt_idx" ON "ProviderWebhookReceipt"("channel", "receivedAt");
