CREATE TYPE "public"."riddle_outcome" AS ENUM('found', 'lost');--> statement-breakpoint
CREATE TABLE "daily_riddles" (
	"day" date PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"clues" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "riddle_plays" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"step" smallint NOT NULL,
	"outcome" "riddle_outcome",
	"xp" smallint DEFAULT 0 NOT NULL,
	"card_given" boolean DEFAULT false NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"answered_at" timestamp with time zone NOT NULL,
	CONSTRAINT "riddle_plays_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "riddle_words" (
	"card_id" text PRIMARY KEY NOT NULL,
	"clues" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_riddles" ADD CONSTRAINT "daily_riddles_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riddle_plays" ADD CONSTRAINT "riddle_plays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riddle_plays" ADD CONSTRAINT "riddle_plays_day_daily_riddles_day_fk" FOREIGN KEY ("day") REFERENCES "public"."daily_riddles"("day") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riddle_words" ADD CONSTRAINT "riddle_words_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_riddles_card_idx" ON "daily_riddles" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "riddle_plays_day_outcome_idx" ON "riddle_plays" USING btree ("day","outcome");