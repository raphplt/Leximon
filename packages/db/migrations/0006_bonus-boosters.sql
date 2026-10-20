CREATE TYPE "public"."booster_bonus_kind" AS ENUM('daily', 'gilded');--> statement-breakpoint
CREATE TABLE "booster_bonus_awards" (
	"user_id" text NOT NULL,
	"kind" "booster_bonus_kind" NOT NULL,
	"award_key" text NOT NULL,
	"amount" smallint NOT NULL,
	"credited" smallint NOT NULL,
	"challenge_id" uuid NOT NULL,
	"awarded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "booster_bonus_awards_user_id_kind_award_key_pk" PRIMARY KEY("user_id","kind","award_key"),
	CONSTRAINT "booster_bonus_awards_amount_check" CHECK ("booster_bonus_awards"."amount" > 0),
	CONSTRAINT "booster_bonus_awards_credited_check" CHECK ("booster_bonus_awards"."credited" >= 0 and "booster_bonus_awards"."credited" <= "booster_bonus_awards"."amount")
);
--> statement-breakpoint
ALTER TABLE "booster_opens" ADD COLUMN "from_bonus" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booster_wallets" ADD COLUMN "bonus_boosters" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "booster_bonus_awards" ADD CONSTRAINT "booster_bonus_awards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booster_bonus_awards_user_challenge_idx" ON "booster_bonus_awards" USING btree ("user_id","challenge_id");--> statement-breakpoint
ALTER TABLE "booster_wallets" ADD CONSTRAINT "booster_wallets_bonus_check" CHECK ("booster_wallets"."bonus_boosters" >= 0);