CREATE TABLE "user_progress" (
	"user_id" text PRIMARY KEY NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_progress_xp_check" CHECK ("user_progress"."xp" >= 0)
);
--> statement-breakpoint
ALTER TABLE "booster_wallets" ADD COLUMN "last_opened_day" date;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;