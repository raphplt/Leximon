ALTER TABLE "players" ADD COLUMN "joust_guide_done_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jousts" ADD COLUMN "challenger_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jousts" ADD COLUMN "opponent_seen_at" timestamp with time zone;--> statement-breakpoint
-- Results already shown before the reveal existed stay opened.
UPDATE "jousts" SET "challenger_seen_at" = "ended_at", "opponent_seen_at" = "ended_at" WHERE "ended_at" IS NOT NULL;
