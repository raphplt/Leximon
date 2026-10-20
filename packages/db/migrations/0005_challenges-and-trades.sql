CREATE TYPE "public"."challenge_format" AS ENUM('definition', 'word');--> statement-breakpoint
CREATE TYPE "public"."mastery_level" AS ENUM('sketch', 'ink', 'gilded');--> statement-breakpoint
CREATE TYPE "public"."trade_side" AS ENUM('give', 'want');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('pending', 'completed', 'declined', 'cancelled');--> statement-breakpoint
CREATE TABLE "players" (
	"user_id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"challenge_id" uuid NOT NULL,
	"format" "challenge_format" NOT NULL,
	"correct" boolean NOT NULL,
	"rating" smallint NOT NULL,
	"level_after" "mastery_level" NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "review_logs_id_reviewed_at_pk" PRIMARY KEY("id","reviewed_at")
) PARTITION BY RANGE ("reviewed_at");
--> statement-breakpoint
CREATE TABLE "trade_items" (
	"trade_id" uuid NOT NULL,
	"side" "trade_side" NOT NULL,
	"card_id" text NOT NULL,
	CONSTRAINT "trade_items_trade_id_side_card_id_pk" PRIMARY KEY("trade_id","side","card_id")
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY NOT NULL,
	"proposer_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"status" "trade_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "trades_not_self_check" CHECK ("trades"."proposer_id" <> "trades"."recipient_id")
);
--> statement-breakpoint
CREATE TABLE "user_mastery" (
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"level" "mastery_level" DEFAULT 'sketch' NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"stability" double precision NOT NULL,
	"difficulty" double precision NOT NULL,
	"scheduled_days" integer NOT NULL,
	"learning_steps" integer NOT NULL,
	"reps" integer NOT NULL,
	"lapses" integer NOT NULL,
	"state" smallint NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	CONSTRAINT "user_mastery_user_id_card_id_pk" PRIMARY KEY("user_id","card_id")
);
--> statement-breakpoint
ALTER TABLE "user_cards" ADD COLUMN "last_obtained_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Copies owned before this column existed: the first copy is the best known date.
UPDATE "user_cards" SET "last_obtained_at" = "first_obtained_at";--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_proposer_id_users_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_mastery" ADD CONSTRAINT "user_mastery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_mastery" ADD CONSTRAINT "user_mastery_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_logs_user_challenge_idx" ON "review_logs" USING btree ("user_id","challenge_id");--> statement-breakpoint
CREATE INDEX "review_logs_user_reviewed_idx" ON "review_logs" USING btree ("user_id","reviewed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "trades_proposer_idempotency_idx" ON "trades" USING btree ("proposer_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "trades_proposer_created_idx" ON "trades" USING btree ("proposer_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "trades_recipient_created_idx" ON "trades" USING btree ("recipient_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_mastery_due_idx" ON "user_mastery" USING btree ("user_id","due");--> statement-breakpoint

-- Safety net: rows land here if a monthly partition is missing, so inserts never fail.
CREATE TABLE "review_logs_default" PARTITION OF "review_logs" DEFAULT;--> statement-breakpoint

-- Creates the monthly partitions of review_logs from the current month up to `months_ahead`
-- months later. Idempotent; called by this migration and by the daily maintenance.
CREATE FUNCTION "leximon_ensure_review_log_partitions"(months_ahead integer DEFAULT 2)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  month_start date;
  partition_name text;
BEGIN
  FOR offset_months IN 0..months_ahead LOOP
    month_start := (date_trunc('month', now() AT TIME ZONE 'UTC') + make_interval(months => offset_months))::date;
    partition_name := format('review_logs_%s', to_char(month_start, 'YYYY_MM'));
    IF to_regclass(partition_name) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF "review_logs" FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        month_start::timestamp AT TIME ZONE 'UTC',
        (month_start + interval '1 month')::timestamp AT TIME ZONE 'UTC'
      );
    END IF;
  END LOOP;
END;
$$;--> statement-breakpoint
SELECT "leximon_ensure_review_log_partitions"(2);
