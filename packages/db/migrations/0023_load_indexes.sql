CREATE INDEX "users_created_idx" ON "users" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "clan_messages_author_idx" ON "clan_messages" USING btree ("author_id") WHERE "clan_messages"."author_id" is not null;--> statement-breakpoint
CREATE INDEX "clan_messages_deleted_by_idx" ON "clan_messages" USING btree ("deleted_by") WHERE "clan_messages"."deleted_by" is not null;--> statement-breakpoint
CREATE INDEX "email_campaign_sends_user_idx" ON "email_campaign_sends" USING btree ("user_id") WHERE "email_campaign_sends"."user_id" is not null;