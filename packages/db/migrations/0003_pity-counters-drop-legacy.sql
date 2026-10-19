ALTER TABLE "booster_wallets" DROP CONSTRAINT "booster_wallets_pity_check";--> statement-breakpoint
ALTER TABLE "booster_opens" DROP COLUMN "pity_counter_before";--> statement-breakpoint
ALTER TABLE "booster_wallets" DROP COLUMN "pity_counter";