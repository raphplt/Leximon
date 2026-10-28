CREATE TABLE "sign_in_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sign_in_emails_kind_check" CHECK ("sign_in_emails"."kind" in ('code', 'invitation_only')),
	CONSTRAINT "sign_in_emails_status_check" CHECK ("sign_in_emails"."status" in ('sent', 'failed'))
);
--> statement-breakpoint
CREATE INDEX "sign_in_emails_created_idx" ON "sign_in_emails" USING btree ("created_at");