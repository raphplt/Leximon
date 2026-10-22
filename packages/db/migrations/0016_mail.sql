CREATE TYPE "public"."mail_kind" AS ENUM('offer_received', 'offer_completed', 'offer_declined', 'clan_mention', 'clan_request');--> statement-breakpoint
CREATE TABLE "mail_letters" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mail_letters_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"kind" "mail_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "clan_messages" ADD COLUMN "mentions" jsonb;--> statement-breakpoint
ALTER TABLE "mail_letters" ADD CONSTRAINT "mail_letters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mail_letters_dedupe_idx" ON "mail_letters" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "mail_letters_user_idx" ON "mail_letters" USING btree ("user_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "mail_letters_unread_idx" ON "mail_letters" USING btree ("user_id") WHERE "mail_letters"."read_at" is null;--> statement-breakpoint
CREATE INDEX "mail_letters_created_idx" ON "mail_letters" USING btree ("created_at");