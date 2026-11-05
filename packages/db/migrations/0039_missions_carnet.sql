ALTER TYPE "public"."ecu_movement_kind" ADD VALUE 'perfect_start';--> statement-breakpoint
ALTER TYPE "public"."ecu_movement_kind" ADD VALUE 'mission';--> statement-breakpoint
ALTER TYPE "public"."ecu_movement_kind" ADD VALUE 'carnet';--> statement-breakpoint
CREATE TABLE "user_carnet_cases" (
	"user_id" text NOT NULL,
	"period" integer NOT NULL,
	"case" smallint NOT NULL,
	"rewards" jsonb NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_carnet_cases_user_id_period_case_pk" PRIMARY KEY("user_id","period","case"),
	CONSTRAINT "user_carnet_cases_case_check" CHECK ("user_carnet_cases"."case" >= 1)
);
--> statement-breakpoint
CREATE TABLE "user_missions" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"missions" jsonb NOT NULL,
	"claimed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bonus_claimed" boolean DEFAULT false NOT NULL,
	"change_key" uuid,
	"drawn_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_missions_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "user_carnet_cases" ADD CONSTRAINT "user_carnet_cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;