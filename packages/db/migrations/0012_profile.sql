CREATE TABLE "moderation_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"reported_id" text NOT NULL,
	"pseudo" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pinned_cards" (
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "pinned_cards_user_id_card_id_pk" PRIMARY KEY("user_id","card_id"),
	CONSTRAINT "pinned_cards_position_check" CHECK ("pinned_cards"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "user_blocks_not_self_check" CHECK ("user_blocks"."blocker_id" <> "user_blocks"."blocked_id")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"notify_reviews" boolean DEFAULT true NOT NULL,
	"notify_trades" boolean DEFAULT true NOT NULL,
	"notify_clan_mentions" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trades" DROP CONSTRAINT "trades_proposer_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "trades" DROP CONSTRAINT "trades_recipient_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "proposer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "recipient_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booster_wallets" ADD COLUMN "days_played" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "pseudo" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "pseudo_key" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "pseudo_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "avatar" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "frame" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "profile_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_reported_id_users_id_fk" FOREIGN KEY ("reported_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinned_cards" ADD CONSTRAINT "pinned_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinned_cards" ADD CONSTRAINT "pinned_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_reports_once_idx" ON "moderation_reports" USING btree ("reporter_id","reported_id","pseudo");--> statement-breakpoint
CREATE INDEX "moderation_reports_open_idx" ON "moderation_reports" USING btree ("created_at") WHERE "moderation_reports"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "moderation_reports_reported_idx" ON "moderation_reports" USING btree ("reported_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pinned_cards_position_idx" ON "pinned_cards" USING btree ("user_id","position");--> statement-breakpoint
CREATE INDEX "user_blocks_blocked_idx" ON "user_blocks" USING btree ("blocked_id");--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_proposer_id_users_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "players_pseudo_key_idx" ON "players" USING btree ("pseudo_key");--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_pseudo_check" CHECK (("players"."pseudo" is null) = ("players"."pseudo_key" is null) and ("players"."pseudo" is null) = ("players"."pseudo_changed_at" is null));--> statement-breakpoint
-- Days already played, from the boosters opened so far (a day in Paris, like the first open of the day).
UPDATE "booster_wallets" SET "days_played" = "played"."days"
FROM (
	SELECT "user_id", count(DISTINCT ("opened_at" AT TIME ZONE 'Europe/Paris')::date)::integer AS "days"
	FROM "booster_opens" GROUP BY "user_id"
) AS "played"
WHERE "played"."user_id" = "booster_wallets"."user_id";
