ALTER TYPE "public"."goal_tier" ADD VALUE 'illuminated';--> statement-breakpoint
ALTER TABLE "clan_week_members" ADD COLUMN "answers" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clan_weeks" ADD COLUMN "illuminated" integer;--> statement-breakpoint
ALTER TABLE "clan_weeks" ADD COLUMN "answers" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clan_weeks" ADD COLUMN "xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clans" ADD COLUMN "xp" integer DEFAULT 0 NOT NULL;