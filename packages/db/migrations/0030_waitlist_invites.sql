ALTER TABLE "email_campaigns" DROP CONSTRAINT "email_campaigns_audience_check";--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN "invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN "invite_campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD CONSTRAINT "waitlist_signups_invite_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("invite_campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "waitlist_signups_to_invite_idx" ON "waitlist_signups" USING btree ("created_at","email") WHERE "waitlist_signups"."invited_at" is null;--> statement-breakpoint
CREATE INDEX "waitlist_signups_campaign_idx" ON "waitlist_signups" USING btree ("invite_campaign_id") WHERE "waitlist_signups"."invite_campaign_id" is not null;--> statement-breakpoint
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_audience_check" CHECK ("email_campaigns"."audience" in ('waitlist', 'waitlist_invite', 'players', 'test'));