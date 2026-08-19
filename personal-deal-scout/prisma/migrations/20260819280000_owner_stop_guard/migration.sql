CREATE OR REPLACE FUNCTION enforce_terminal_owner_stop() RETURNS trigger AS $$ BEGIN
  IF OLD."controlStatus" = 'STOPPED' AND (NEW."controlStatus" <> 'STOPPED' OR NEW."status" <> 'CANCELLED') THEN
    RAISE EXCEPTION 'A stopped transaction is terminal and must remain cancelled';
  END IF;
  IF NEW."controlStatus" = 'STOPPED' AND NEW."status" <> 'CANCELLED' THEN
    RAISE EXCEPTION 'A stopped transaction must be cancelled';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "DealTransaction_terminal_owner_stop" BEFORE UPDATE ON "DealTransaction" FOR EACH ROW EXECUTE FUNCTION enforce_terminal_owner_stop();
