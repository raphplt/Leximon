CREATE TYPE "public"."ecu_movement_kind" AS ENUM('recycle', 'missing_word');--> statement-breakpoint
CREATE TABLE "ecu_movements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "ecu_movement_kind" NOT NULL,
	"amount" integer NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ecu_movements_amount_check" CHECK ("ecu_movements"."amount" <> 0)
);
--> statement-breakpoint
ALTER TABLE "booster_wallets" ADD COLUMN "ecus" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ecu_movements" ADD CONSTRAINT "ecu_movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ecu_movements_user_key_idx" ON "ecu_movements" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "ecu_movements_user_created_idx" ON "ecu_movements" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "booster_wallets" ADD CONSTRAINT "booster_wallets_ecus_check" CHECK ("booster_wallets"."ecus" >= 0);