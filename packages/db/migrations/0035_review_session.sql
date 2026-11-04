ALTER TYPE "public"."mastery_level" ADD VALUE 'blank' BEFORE 'sketch';--> statement-breakpoint
ALTER TABLE "practice_answers" ADD COLUMN "card_id" text;--> statement-breakpoint
ALTER TABLE "practice_answers" ADD COLUMN "format" "challenge_format";--> statement-breakpoint
ALTER TABLE "user_mastery" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "review_length" smallint DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "new_words_per_day" smallint DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;