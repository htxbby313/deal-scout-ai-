ALTER TABLE "Developer"
ADD COLUMN "communicationsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "BuyerConversation" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "providerReference" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BuyerConversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BuyerConversation_providerReference_key" ON "BuyerConversation"("providerReference");
CREATE INDEX "BuyerConversation_developerId_occurredAt_idx" ON "BuyerConversation"("developerId", "occurredAt");
ALTER TABLE "BuyerConversation" ADD CONSTRAINT "BuyerConversation_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
