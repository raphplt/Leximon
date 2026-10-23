ALTER TABLE "user_cards" ADD COLUMN "read_at" timestamp with time zone;--> statement-breakpoint
-- Cards owned before the read mark existed count as read: the album does not fill up with new tags at once.
UPDATE "user_cards" SET "read_at" = "first_obtained_at";
