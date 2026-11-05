CREATE TYPE "public"."joust_kind" AS ENUM('ranked', 'friendly');--> statement-breakpoint
ALTER TYPE "public"."mail_kind" ADD VALUE 'joust_received';--> statement-breakpoint
ALTER TYPE "public"."mail_kind" ADD VALUE 'joust_ended';--> statement-breakpoint
CREATE TABLE "joust_decks" (
	"user_id" text PRIMARY KEY NOT NULL,
	"card_ids" text[] NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "joust_questions" (
	"joust_id" uuid NOT NULL,
	"answerer_id" text NOT NULL,
	"position" smallint NOT NULL,
	"card_id" text NOT NULL,
	"choices" text[] NOT NULL,
	"served_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	"chosen_card_id" text,
	"correct" boolean,
	CONSTRAINT "joust_questions_joust_id_answerer_id_position_pk" PRIMARY KEY("joust_id","answerer_id","position"),
	CONSTRAINT "joust_questions_position_check" CHECK ("joust_questions"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "joust_ratings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"rating" double precision NOT NULL,
	"deviation" double precision NOT NULL,
	"volatility" double precision NOT NULL,
	"games" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jousts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "joust_kind" NOT NULL,
	"challenger_id" text NOT NULL,
	"opponent_id" text NOT NULL,
	"launch_key" uuid NOT NULL,
	"revenge_of" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"challenger_done_at" timestamp with time zone,
	"challenger_correct" smallint,
	"challenger_ms" integer,
	"reply_by" timestamp with time zone,
	"opponent_started_at" timestamp with time zone,
	"opponent_done_at" timestamp with time zone,
	"opponent_correct" smallint,
	"opponent_ms" integer,
	"ended_at" timestamp with time zone,
	"outcome" text,
	"forfeit" boolean DEFAULT false NOT NULL,
	"challenger_rewarded" boolean DEFAULT false NOT NULL,
	"opponent_rewarded" boolean DEFAULT false NOT NULL,
	"challenger_xp" integer DEFAULT 0 NOT NULL,
	"opponent_xp" integer DEFAULT 0 NOT NULL,
	"challenger_boosters" smallint DEFAULT 0 NOT NULL,
	"opponent_boosters" smallint DEFAULT 0 NOT NULL,
	"ratings" jsonb,
	CONSTRAINT "jousts_players_check" CHECK ("jousts"."challenger_id" <> "jousts"."opponent_id"),
	CONSTRAINT "jousts_outcome_check" CHECK ("jousts"."outcome" is null or "jousts"."outcome" in ('challenger', 'opponent', 'draw'))
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "definition" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "joust_access" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "joust_decks" ADD CONSTRAINT "joust_decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joust_questions" ADD CONSTRAINT "joust_questions_joust_id_jousts_id_fk" FOREIGN KEY ("joust_id") REFERENCES "public"."jousts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joust_questions" ADD CONSTRAINT "joust_questions_answerer_id_users_id_fk" FOREIGN KEY ("answerer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joust_questions" ADD CONSTRAINT "joust_questions_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joust_ratings" ADD CONSTRAINT "joust_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jousts" ADD CONSTRAINT "jousts_challenger_id_users_id_fk" FOREIGN KEY ("challenger_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jousts" ADD CONSTRAINT "jousts_opponent_id_users_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "joust_ratings_rating_idx" ON "joust_ratings" USING btree ("rating");--> statement-breakpoint
CREATE UNIQUE INDEX "jousts_launch_idx" ON "jousts" USING btree ("challenger_id","launch_key");--> statement-breakpoint
CREATE INDEX "jousts_challenger_idx" ON "jousts" USING btree ("challenger_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jousts_opponent_idx" ON "jousts" USING btree ("opponent_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jousts_open_idx" ON "jousts" USING btree ("reply_by") WHERE "jousts"."ended_at" is null;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "notify_jousts" boolean DEFAULT true NOT NULL;