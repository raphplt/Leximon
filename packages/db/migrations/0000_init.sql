CREATE TYPE "public"."rarity" AS ENUM('common', 'uncommon', 'rare', 'precious', 'epic', 'legendary');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booster_open_requests" (
	"user_id" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"open_id" uuid NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	CONSTRAINT "booster_open_requests_user_id_idempotency_key_pk" PRIMARY KEY("user_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "booster_opens" (
	"id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"seed" text NOT NULL,
	"pool_fingerprint" text NOT NULL,
	"pity_counter_before" integer NOT NULL,
	"cards" jsonb NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	CONSTRAINT "booster_opens_id_opened_at_pk" PRIMARY KEY("id","opened_at")
) PARTITION BY RANGE ("opened_at");
--> statement-breakpoint
CREATE TABLE "booster_wallets" (
	"user_id" text PRIMARY KEY NOT NULL,
	"stored" integer NOT NULL,
	"progress_ms" integer NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"pity_counter" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "booster_wallets_stored_check" CHECK ("booster_wallets"."stored" >= 0),
	CONSTRAINT "booster_wallets_progress_check" CHECK ("booster_wallets"."progress_ms" >= 0),
	CONSTRAINT "booster_wallets_pity_check" CHECK ("booster_wallets"."pity_counter" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"lemma" text NOT NULL,
	"rarity" "rarity" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_cards" (
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"variant" text DEFAULT 'standard' NOT NULL,
	"quantity" integer NOT NULL,
	"first_obtained_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_cards_user_id_card_id_variant_pk" PRIMARY KEY("user_id","card_id","variant"),
	CONSTRAINT "user_cards_quantity_check" CHECK ("user_cards"."quantity" >= 0)
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booster_open_requests" ADD CONSTRAINT "booster_open_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booster_open_requests" ADD CONSTRAINT "booster_open_requests_open_id_opened_at_booster_opens_id_opened_at_fk" FOREIGN KEY ("open_id","opened_at") REFERENCES "public"."booster_opens"("id","opened_at") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booster_opens" ADD CONSTRAINT "booster_opens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booster_wallets" ADD CONSTRAINT "booster_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_index" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_index" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "booster_open_requests_opened_idx" ON "booster_open_requests" USING btree ("opened_at");--> statement-breakpoint
CREATE INDEX "booster_opens_user_opened_idx" ON "booster_opens" USING btree ("user_id","opened_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cards_drawable_idx" ON "cards" USING btree ("rarity") WHERE "cards"."retired_at" is null;