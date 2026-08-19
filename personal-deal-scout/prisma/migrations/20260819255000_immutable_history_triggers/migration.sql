-- Final outcomes, financial versions, and score histories are append-only.
CREATE OR REPLACE FUNCTION "reject_history_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; record a correction/version instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TransactionOutcome_append_only" BEFORE UPDATE OR DELETE ON "TransactionOutcome" FOR EACH ROW EXECUTE FUNCTION "reject_history_mutation"();
CREATE TRIGGER "FinancialProjection_append_only" BEFORE UPDATE OR DELETE ON "FinancialProjection" FOR EACH ROW EXECUTE FUNCTION "reject_history_mutation"();
CREATE TRIGGER "SettlementReview_append_only" BEFORE UPDATE OR DELETE ON "SettlementReview" FOR EACH ROW EXECUTE FUNCTION "reject_history_mutation"();
CREATE TRIGGER "ProfitPriorityScoreHistory_append_only" BEFORE UPDATE OR DELETE ON "ProfitPriorityScoreHistory" FOR EACH ROW EXECUTE FUNCTION "reject_history_mutation"();
CREATE TRIGGER "BuyerReliabilityScoreHistory_append_only" BEFORE UPDATE OR DELETE ON "BuyerReliabilityScoreHistory" FOR EACH ROW EXECUTE FUNCTION "reject_history_mutation"();

-- A stage-history row may only receive its first exitedAt timestamp. All other
-- corrections require a new history row so the original decision remains visible.
CREATE OR REPLACE FUNCTION "guard_stage_history_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."exitedAt" IS NULL
     AND NEW."exitedAt" IS NOT NULL
     AND (to_jsonb(NEW) - 'exitedAt') = (to_jsonb(OLD) - 'exitedAt') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'AcquisitionStageHistory is append-only except for first exit timestamp';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AcquisitionStageHistory_guard" BEFORE UPDATE OR DELETE ON "AcquisitionStageHistory" FOR EACH ROW EXECUTE FUNCTION "guard_stage_history_mutation"();
