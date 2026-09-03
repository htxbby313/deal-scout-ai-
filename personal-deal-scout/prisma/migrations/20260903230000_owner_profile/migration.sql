-- Single-owner identity for Deal Packages. Not a multi-user Profile table.
ALTER TABLE "SystemSetting"
ADD COLUMN "ownerDisplayName" TEXT,
ADD COLUMN "companyName" TEXT,
ADD COLUMN "ownerPhone" TEXT,
ADD COLUMN "ownerEmail" TEXT,
ADD COLUMN "markets" TEXT[] DEFAULT ARRAY[]::TEXT[];
