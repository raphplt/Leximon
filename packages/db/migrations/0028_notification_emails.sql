CREATE TABLE "notification_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"day" date NOT NULL,
	"status" text DEFAULT 'sending' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "notification_emails_kind_check" CHECK ("notification_emails"."kind" in ('news', 'reminder')),
	CONSTRAINT "notification_emails_status_check" CHECK ("notification_emails"."status" in ('sending', 'sent', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "email_news" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "email_reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_emails" ADD CONSTRAINT "notification_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_emails_once_idx" ON "notification_emails" USING btree ("user_id","kind","day");--> statement-breakpoint
CREATE INDEX "notification_emails_day_idx" ON "notification_emails" USING btree ("day");--> statement-breakpoint
CREATE INDEX "notification_emails_created_idx" ON "notification_emails" USING btree ("created_at");