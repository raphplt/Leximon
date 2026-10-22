CREATE TABLE "email_campaign_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"email" text,
	"user_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"provider_message_id" text,
	"last_error" text,
	"unsubscribed_at" timestamp with time zone,
	CONSTRAINT "email_campaign_sends_status_check" CHECK ("email_campaign_sends"."status" in ('pending', 'queued', 'sending', 'sent', 'failed', 'bounced', 'complained', 'suppressed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "email_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body_markdown" text NOT NULL,
	"button_label" text,
	"button_url" text,
	"audience" text NOT NULL,
	"test_recipients" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"rate_per_minute" integer DEFAULT 1000 NOT NULL,
	"recipient_count" integer,
	"created_by" text NOT NULL,
	"launched_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scheduled_at" timestamp with time zone,
	"launched_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"hold_until" timestamp with time zone,
	"waitlist_erased_at" timestamp with time zone,
	CONSTRAINT "email_campaigns_audience_check" CHECK ("email_campaigns"."audience" in ('waitlist', 'players', 'test')),
	CONSTRAINT "email_campaigns_status_check" CHECK ("email_campaigns"."status" in ('draft', 'scheduled', 'sending', 'paused', 'completed', 'cancelled')),
	CONSTRAINT "email_campaigns_rate_check" CHECK ("email_campaigns"."rate_per_minute" between 10 and 5000)
);
--> statement-breakpoint
CREATE TABLE "email_consents" (
	"user_id" text PRIMARY KEY NOT NULL,
	"granted_at" timestamp with time zone,
	"granted_source" text,
	"revoked_at" timestamp with time zone,
	"revoked_source" text
);
--> statement-breakpoint
CREATE TABLE "email_suppressions" (
	"email" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"campaign_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_suppressions_reason_check" CHECK ("email_suppressions"."reason" in ('unsubscribed', 'hard_bounce', 'complaint', 'manual'))
);
--> statement-breakpoint
ALTER TABLE "email_campaign_sends" ADD CONSTRAINT "email_campaign_sends_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_campaign_sends" ADD CONSTRAINT "email_campaign_sends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_launched_by_users_id_fk" FOREIGN KEY ("launched_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_consents" ADD CONSTRAINT "email_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_campaign_sends_recipient_idx" ON "email_campaign_sends" USING btree ("campaign_id","email");--> statement-breakpoint
CREATE INDEX "email_campaign_sends_status_idx" ON "email_campaign_sends" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "email_campaign_sends_claimed_idx" ON "email_campaign_sends" USING btree ("claimed_at") WHERE "email_campaign_sends"."status" in ('queued', 'sending');--> statement-breakpoint
CREATE INDEX "email_campaign_sends_provider_idx" ON "email_campaign_sends" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "email_campaigns_created_idx" ON "email_campaigns" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "email_campaigns_active_idx" ON "email_campaigns" USING btree ("status") WHERE "email_campaigns"."status" in ('scheduled', 'sending');--> statement-breakpoint
CREATE UNIQUE INDEX "email_campaigns_waitlist_once_idx" ON "email_campaigns" USING btree ("audience") WHERE "email_campaigns"."audience" = 'waitlist' and "email_campaigns"."launched_at" is not null;