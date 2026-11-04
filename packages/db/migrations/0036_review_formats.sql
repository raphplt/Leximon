CREATE TYPE "public"."review_difficulty" AS ENUM('normal', 'hard');--> statement-breakpoint
ALTER TYPE "public"."challenge_format" ADD VALUE 'listen';--> statement-breakpoint
ALTER TYPE "public"."challenge_format" ADD VALUE 'letters';--> statement-breakpoint
ALTER TYPE "public"."challenge_format" ADD VALUE 'pairs';--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "review_listen" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "review_letters" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "review_pairs" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "review_difficulty" "review_difficulty" DEFAULT 'normal' NOT NULL;