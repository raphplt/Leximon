-- Card rarity is frozen once published: changing it would rewrite what players already own.
CREATE FUNCTION "leximon_forbid_rarity_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."rarity" IS DISTINCT FROM OLD."rarity" THEN
    RAISE EXCEPTION 'The rarity of card "%" is frozen: publish a new card instead', OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "cards_rarity_frozen"
  BEFORE UPDATE OF "rarity" ON "cards"
  FOR EACH ROW EXECUTE FUNCTION "leximon_forbid_rarity_change"();--> statement-breakpoint

-- Safety net: rows land here if a monthly partition is missing, so inserts never fail.
CREATE TABLE "booster_opens_default" PARTITION OF "booster_opens" DEFAULT;--> statement-breakpoint

-- Creates the monthly partitions of booster_opens from the current month up to `months_ahead`
-- months later. Idempotent; called by this migration and by the daily maintenance.
CREATE FUNCTION "leximon_ensure_booster_open_partitions"(months_ahead integer DEFAULT 2)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  month_start date;
  partition_name text;
BEGIN
  FOR offset_months IN 0..months_ahead LOOP
    month_start := (date_trunc('month', now() AT TIME ZONE 'UTC') + make_interval(months => offset_months))::date;
    partition_name := format('booster_opens_%s', to_char(month_start, 'YYYY_MM'));
    IF to_regclass(partition_name) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF "booster_opens" FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        month_start::timestamp AT TIME ZONE 'UTC',
        (month_start + interval '1 month')::timestamp AT TIME ZONE 'UTC'
      );
    END IF;
  END LOOP;
END;
$$;--> statement-breakpoint
SELECT "leximon_ensure_booster_open_partitions"(2);
