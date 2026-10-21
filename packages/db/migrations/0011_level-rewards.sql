CREATE TABLE "user_level_rewards" (
	"user_id" text NOT NULL,
	"level" smallint NOT NULL,
	"rewards" jsonb NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL,
	"chosen_card_id" text,
	"chosen_at" timestamp with time zone,
	CONSTRAINT "user_level_rewards_user_id_level_pk" PRIMARY KEY("user_id","level"),
	CONSTRAINT "user_level_rewards_level_check" CHECK ("user_level_rewards"."level" >= 2),
	CONSTRAINT "user_level_rewards_choice_check" CHECK (("user_level_rewards"."chosen_card_id" is null) = ("user_level_rewards"."chosen_at" is null))
);
--> statement-breakpoint
ALTER TABLE "booster_opens" ADD COLUMN "garni" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booster_wallets" ADD COLUMN "garni_boosters" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "booster_wallets" ADD COLUMN "reserve_slots" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_level_rewards" ADD CONSTRAINT "user_level_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_level_rewards" ADD CONSTRAINT "user_level_rewards_chosen_card_id_cards_id_fk" FOREIGN KEY ("chosen_card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booster_wallets" ADD CONSTRAINT "booster_wallets_garni_check" CHECK ("booster_wallets"."garni_boosters" >= 0 and "booster_wallets"."garni_boosters" <= "booster_wallets"."bonus_boosters");--> statement-breakpoint
ALTER TABLE "booster_wallets" ADD CONSTRAINT "booster_wallets_reserve_slots_check" CHECK ("booster_wallets"."reserve_slots" >= 0);