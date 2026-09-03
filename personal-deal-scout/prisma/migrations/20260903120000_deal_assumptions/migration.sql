-- Additive only: persists rehab mode/strategy assumptions on the DealTransaction
-- aggregate so the Deal Box calculator survives navigation/reload. This column
-- is never read by sellerSafeMaximumCents / assignment projected spread math
-- in src/lib/financial-truth.ts; it is a separate "Estimate, not contractor
-- bid" figure surfaced on the Deal header and Deal Package.
ALTER TABLE "DealTransaction"
ADD COLUMN "dealAssumptions" JSONB;
