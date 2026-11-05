CREATE TABLE "user_welcome_days" (
	"user_id" text NOT NULL,
	"day" smallint NOT NULL,
	"rewards" jsonb NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL,
	"claimed_on" date NOT NULL,
	CONSTRAINT "user_welcome_days_user_id_day_pk" PRIMARY KEY("user_id","day"),
	CONSTRAINT "user_welcome_days_day_check" CHECK ("user_welcome_days"."day" >= 1)
);
--> statement-breakpoint
ALTER TABLE "booster_wallets" ADD COLUMN "precious_boosters" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_welcome_days" ADD CONSTRAINT "user_welcome_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_welcome_days_one_a_day" ON "user_welcome_days" USING btree ("user_id","claimed_on");--> statement-breakpoint
ALTER TABLE "booster_wallets" ADD CONSTRAINT "booster_wallets_precious_check" CHECK ("booster_wallets"."precious_boosters" >= 0 and "booster_wallets"."precious_boosters" <= "booster_wallets"."garni_boosters");