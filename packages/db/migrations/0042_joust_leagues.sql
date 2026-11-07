ALTER TYPE "public"."ecu_movement_kind" ADD VALUE 'league';--> statement-breakpoint
CREATE TABLE "joust_league_rewards" (
	"user_id" text NOT NULL,
	"season" integer NOT NULL,
	"step" smallint NOT NULL,
	"rewards" jsonb NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "joust_league_rewards_user_id_season_step_pk" PRIMARY KEY("user_id","season","step"),
	CONSTRAINT "joust_league_rewards_step_check" CHECK ("joust_league_rewards"."step" >= 0)
);
--> statement-breakpoint
CREATE TABLE "joust_standings" (
	"user_id" text NOT NULL,
	"season" integer NOT NULL,
	"started" integer NOT NULL,
	"laurels" integer NOT NULL,
	"peak" integer NOT NULL,
	"streak" smallint DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "joust_standings_user_id_season_pk" PRIMARY KEY("user_id","season"),
	CONSTRAINT "joust_standings_laurels_check" CHECK ("joust_standings"."laurels" >= 0 and "joust_standings"."peak" >= "joust_standings"."laurels")
);
--> statement-breakpoint
ALTER TABLE "jousts" ADD COLUMN "laurels" jsonb;--> statement-breakpoint
ALTER TABLE "joust_league_rewards" ADD CONSTRAINT "joust_league_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joust_standings" ADD CONSTRAINT "joust_standings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "joust_standings_board_idx" ON "joust_standings" USING btree ("season","laurels" DESC NULLS LAST,"user_id");