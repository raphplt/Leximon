CREATE TABLE "analytics_events" (
	"subject" text NOT NULL,
	"name" text NOT NULL,
	"props" jsonb NOT NULL,
	"variants" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL
) PARTITION BY RANGE ("received_at");
--> statement-breakpoint
CREATE INDEX "analytics_events_name_received_idx" ON "analytics_events" USING btree ("name","received_at");--> statement-breakpoint
CREATE INDEX "analytics_events_subject_received_idx" ON "analytics_events" USING btree ("subject","received_at");--> statement-breakpoint

-- Safety net: rows land here if a monthly partition is missing, so inserts never fail.
CREATE TABLE "analytics_events_default" PARTITION OF "analytics_events" DEFAULT;--> statement-breakpoint

-- Creates the monthly partitions of analytics_events from the current month up to
-- `months_ahead` months later. Idempotent; called by this migration and by the daily maintenance.
CREATE FUNCTION "leximon_ensure_analytics_event_partitions"(months_ahead integer DEFAULT 2)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  month_start date;
  partition_name text;
BEGIN
  FOR offset_months IN 0..months_ahead LOOP
    month_start := (date_trunc('month', now() AT TIME ZONE 'UTC') + make_interval(months => offset_months))::date;
    partition_name := format('analytics_events_%s', to_char(month_start, 'YYYY_MM'));
    IF to_regclass(partition_name) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF "analytics_events" FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        month_start::timestamp AT TIME ZONE 'UTC',
        (month_start + interval '1 month')::timestamp AT TIME ZONE 'UTC'
      );
    END IF;
  END LOOP;
END;
$$;--> statement-breakpoint
SELECT "leximon_ensure_analytics_event_partitions"(2);--> statement-breakpoint

-- Drops the monthly partitions that ended more than `months_kept` months ago (CNIL: 13 months
-- at most for audience measurement). Returns how many were dropped. Idempotent.
CREATE FUNCTION "leximon_drop_old_analytics_event_partitions"(months_kept integer DEFAULT 13)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  oldest_kept date := (date_trunc('month', now() AT TIME ZONE 'UTC') - make_interval(months => months_kept))::date;
  partition record;
  dropped integer := 0;
BEGIN
  FOR partition IN
    SELECT child.relname AS name
    FROM pg_inherits
    JOIN pg_class parent ON parent.oid = pg_inherits.inhparent
    JOIN pg_class child ON child.oid = pg_inherits.inhrelid
    WHERE parent.relname = 'analytics_events'
      AND child.relname ~ '^analytics_events_\d{4}_\d{2}$'
  LOOP
    IF to_date(substring(partition.name FROM '\d{4}_\d{2}$'), 'YYYY_MM') < oldest_kept THEN
      EXECUTE format('DROP TABLE %I', partition.name);
      dropped := dropped + 1;
    END IF;
  END LOOP;
  RETURN dropped;
END;
$$;
