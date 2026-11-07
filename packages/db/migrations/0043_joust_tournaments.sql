ALTER TYPE "public"."joust_kind" ADD VALUE 'free' BEFORE 'friendly';--> statement-breakpoint
CREATE TABLE "joust_group_members" (
	"user_id" text NOT NULL,
	"week" integer NOT NULL,
	"group_id" uuid NOT NULL,
	"league" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"scored_at" timestamp with time zone NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	CONSTRAINT "joust_group_members_user_id_week_pk" PRIMARY KEY("user_id","week"),
	CONSTRAINT "joust_group_members_points_check" CHECK ("joust_group_members"."points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "joust_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week" integer NOT NULL,
	"league" text NOT NULL,
	"seed" text NOT NULL,
	"players" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "joust_groups_players_check" CHECK ("joust_groups"."players" >= 0)
);
--> statement-breakpoint
CREATE TABLE "joust_week_rewards" (
	"user_id" text NOT NULL,
	"week" integer NOT NULL,
	"rewards" jsonb NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "joust_week_rewards_user_id_week_pk" PRIMARY KEY("user_id","week")
);
--> statement-breakpoint
ALTER TABLE "jousts" ADD COLUMN "points" jsonb;--> statement-breakpoint
ALTER TABLE "joust_group_members" ADD CONSTRAINT "joust_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joust_group_members" ADD CONSTRAINT "joust_group_members_group_id_joust_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."joust_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joust_week_rewards" ADD CONSTRAINT "joust_week_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "joust_group_members_group_idx" ON "joust_group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "joust_group_members_week_idx" ON "joust_group_members" USING btree ("week","points" DESC NULLS LAST,"user_id");--> statement-breakpoint
CREATE INDEX "joust_groups_open_idx" ON "joust_groups" USING btree ("week","league","players");