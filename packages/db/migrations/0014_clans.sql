CREATE TYPE "public"."clan_entry_mode" AS ENUM('open', 'request', 'invite');--> statement-breakpoint
CREATE TYPE "public"."clan_message_kind" AS ENUM('message', 'event');--> statement-breakpoint
CREATE TYPE "public"."clan_role" AS ENUM('chief', 'deputy', 'member');--> statement-breakpoint
CREATE TYPE "public"."goal_tier" AS ENUM('bronze', 'silver', 'gold');--> statement-breakpoint
CREATE TYPE "public"."contest_outcome" AS ENUM('upheld', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."report_resolution" AS ENUM('dismissed', 'sanctioned');--> statement-breakpoint
CREATE TYPE "public"."report_target" AS ENUM('pseudo', 'clan_name', 'message');--> statement-breakpoint
CREATE TYPE "public"."sanction_kind" AS ENUM('hide_message', 'reset_pseudo', 'reset_clan_name', 'mute', 'trade_ban', 'suspend', 'close');--> statement-breakpoint
CREATE TABLE "clan_goal_claims" (
	"user_id" text NOT NULL,
	"week" text NOT NULL,
	"tier" "goal_tier" NOT NULL,
	"clan_id" uuid NOT NULL,
	"boosters" integer NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "clan_goal_claims_user_id_week_tier_pk" PRIMARY KEY("user_id","week","tier")
);
--> statement-breakpoint
CREATE TABLE "clan_join_requests" (
	"clan_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "clan_join_requests_clan_id_user_id_pk" PRIMARY KEY("clan_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "clan_library" (
	"clan_id" uuid NOT NULL,
	"collection_id" text NOT NULL,
	"owned" integer NOT NULL,
	CONSTRAINT "clan_library_clan_id_collection_id_pk" PRIMARY KEY("clan_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE "clan_members" (
	"user_id" text PRIMARY KEY NOT NULL,
	"clan_id" uuid NOT NULL,
	"role" "clan_role" NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"muted_until" timestamp with time zone,
	"last_message_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "clan_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clan_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"clan_id" uuid NOT NULL,
	"kind" "clan_message_kind" NOT NULL,
	"author_id" text,
	"body" text,
	"event" jsonb,
	"event_key" text,
	"created_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"hidden_at" timestamp with time zone,
	CONSTRAINT "clan_messages_kind_check" CHECK (("clan_messages"."kind" = 'message') = ("clan_messages"."event" is null))
);
--> statement-breakpoint
CREATE TABLE "clan_week_members" (
	"clan_id" uuid NOT NULL,
	"week" text NOT NULL,
	"user_id" text NOT NULL,
	"words" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "clan_week_members_clan_id_week_user_id_pk" PRIMARY KEY("clan_id","week","user_id")
);
--> statement-breakpoint
CREATE TABLE "clan_weeks" (
	"clan_id" uuid NOT NULL,
	"week" text NOT NULL,
	"active_members" integer NOT NULL,
	"bronze" integer NOT NULL,
	"silver" integer NOT NULL,
	"gold" integer NOT NULL,
	"words" integer DEFAULT 0 NOT NULL,
	"tier" "goal_tier",
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "clan_weeks_clan_id_week_pk" PRIMARY KEY("clan_id","week")
);
--> statement-breakpoint
CREATE TABLE "clans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"motto" text DEFAULT '' NOT NULL,
	"entry_mode" "clan_entry_mode" NOT NULL,
	"invite_code" text NOT NULL,
	"emblem_engraving" text NOT NULL,
	"emblem_color" text NOT NULL,
	"emblem_accent" text NOT NULL,
	"emblem_unlocked" integer DEFAULT 0 NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"library_counted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "clans_member_count_check" CHECK ("clans"."member_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sanctions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "sanction_kind" NOT NULL,
	"reason" text NOT NULL,
	"until" timestamp with time zone,
	"report_id" uuid,
	"message_id" integer,
	"clan_id" uuid,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"seen_at" timestamp with time zone,
	"contested_at" timestamp with time zone,
	"contest_text" text,
	"contest_resolved_at" timestamp with time zone,
	"contest_outcome" "contest_outcome",
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sanctions_until_check" CHECK (("sanctions"."until" is not null) = ("sanctions"."kind" in ('mute', 'trade_ban', 'suspend'))),
	CONSTRAINT "sanctions_contest_check" CHECK (("sanctions"."contested_at" is null) = ("sanctions"."contest_text" is null))
);
--> statement-breakpoint
DROP INDEX "moderation_reports_once_idx";--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD COLUMN "target_kind" "report_target" DEFAULT 'pseudo' NOT NULL;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD COLUMN "target_key" text;--> statement-breakpoint
-- Reports so far are all of a pseudo: the pseudo is their target.
UPDATE "moderation_reports" SET "target_key" = "pseudo";--> statement-breakpoint
ALTER TABLE "moderation_reports" ALTER COLUMN "target_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD COLUMN "content" text;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD COLUMN "clan_id" uuid;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD COLUMN "message_id" integer;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD COLUMN "resolved_by" text;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD COLUMN "resolution" "report_resolution";--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "clan_left_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clan_goal_claims" ADD CONSTRAINT "clan_goal_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_join_requests" ADD CONSTRAINT "clan_join_requests_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_join_requests" ADD CONSTRAINT "clan_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_library" ADD CONSTRAINT "clan_library_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_messages" ADD CONSTRAINT "clan_messages_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_messages" ADD CONSTRAINT "clan_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_messages" ADD CONSTRAINT "clan_messages_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_week_members" ADD CONSTRAINT "clan_week_members_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_week_members" ADD CONSTRAINT "clan_week_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_weeks" ADD CONSTRAINT "clan_weeks_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_report_id_moderation_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."moderation_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clan_join_requests_user_idx" ON "clan_join_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clan_members_clan_idx" ON "clan_members" USING btree ("clan_id","joined_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_members_one_chief_idx" ON "clan_members" USING btree ("clan_id") WHERE "clan_members"."role" = 'chief';--> statement-breakpoint
CREATE INDEX "clan_messages_clan_idx" ON "clan_messages" USING btree ("clan_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "clan_messages_event_idx" ON "clan_messages" USING btree ("clan_id","event_key") WHERE "clan_messages"."event_key" is not null;--> statement-breakpoint
CREATE INDEX "clan_messages_created_idx" ON "clan_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "clan_week_members_user_idx" ON "clan_week_members" USING btree ("user_id","week");--> statement-breakpoint
CREATE UNIQUE INDEX "clans_name_key_idx" ON "clans" USING btree ("name_key");--> statement-breakpoint
CREATE UNIQUE INDEX "clans_invite_code_idx" ON "clans" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "clans_name_prefix_idx" ON "clans" USING btree ("name_key" text_pattern_ops);--> statement-breakpoint
CREATE INDEX "clans_members_idx" ON "clans" USING btree ("member_count" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "sanctions_user_idx" ON "sanctions" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sanctions_contested_idx" ON "sanctions" USING btree ("contested_at") WHERE "sanctions"."contested_at" is not null and "sanctions"."contest_resolved_at" is null;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_reports_target_once_idx" ON "moderation_reports" USING btree ("reporter_id","target_kind","target_key");--> statement-breakpoint
CREATE INDEX "moderation_reports_message_idx" ON "moderation_reports" USING btree ("message_id") WHERE "moderation_reports"."message_id" is not null;--> statement-breakpoint
UPDATE "moderation_reports" SET "resolution" = 'dismissed' WHERE "resolved_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_resolution_check" CHECK (("moderation_reports"."resolved_at" is null) = ("moderation_reports"."resolution" is null));