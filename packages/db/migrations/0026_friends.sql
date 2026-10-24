CREATE TYPE "public"."friend_event_kind" AS ENUM('rare_find', 'gilded', 'level', 'collection_complete');--> statement-breakpoint
CREATE TYPE "public"."friend_reaction" AS ENUM('hats_off', 'jealous', 'lucky', 'well_played');--> statement-breakpoint
ALTER TYPE "public"."mail_kind" ADD VALUE 'friend_request';--> statement-breakpoint
ALTER TYPE "public"."mail_kind" ADD VALUE 'friend_accepted';--> statement-breakpoint
ALTER TYPE "public"."mail_kind" ADD VALUE 'referral_arrived';--> statement-breakpoint
ALTER TYPE "public"."mail_kind" ADD VALUE 'referral_qualified';--> statement-breakpoint
ALTER TYPE "public"."mail_kind" ADD VALUE 'friend_reaction';--> statement-breakpoint
CREATE TABLE "friend_feed_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "friend_feed_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"kind" "friend_event_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friend_reactions" (
	"event_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"reaction" "friend_reaction" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "friend_reactions_event_id_user_id_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "friend_requests" (
	"sender_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"declined_at" timestamp with time zone,
	CONSTRAINT "friend_requests_sender_id_recipient_id_pk" PRIMARY KEY("sender_id","recipient_id"),
	CONSTRAINT "friend_requests_not_self_check" CHECK ("friend_requests"."sender_id" <> "friend_requests"."recipient_id")
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"user_id" text NOT NULL,
	"friend_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "friendships_user_id_friend_id_pk" PRIMARY KEY("user_id","friend_id"),
	CONSTRAINT "friendships_not_self_check" CHECK ("friendships"."user_id" <> "friendships"."friend_id")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"referee_id" text PRIMARY KEY NOT NULL,
	"referrer_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"qualified_at" timestamp with time zone,
	"qualified_month" text,
	"rewarded" boolean DEFAULT false NOT NULL,
	"referrer_claimed_at" timestamp with time zone,
	"referee_claimed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "friend_places_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "friend_requests_open" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "share_finds" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "friend_feed_events" ADD CONSTRAINT "friend_feed_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_reactions" ADD CONSTRAINT "friend_reactions_event_id_friend_feed_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."friend_feed_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_reactions" ADD CONSTRAINT "friend_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_id_users_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friend_feed_events_dedupe_idx" ON "friend_feed_events" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "friend_feed_events_user_idx" ON "friend_feed_events" USING btree ("user_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "friend_feed_events_created_idx" ON "friend_feed_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "friend_reactions_user_idx" ON "friend_reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "friend_requests_recipient_idx" ON "friend_requests" USING btree ("recipient_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "friend_requests_sender_created_idx" ON "friend_requests" USING btree ("sender_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "friendships_friend_idx" ON "friendships" USING btree ("friend_id");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_id","qualified_month");