CREATE TABLE "wishes" (
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"source" text NOT NULL,
	"seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "wishes_user_id_card_id_pk" PRIMARY KEY("user_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "joust_traps" (
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"trapped" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "joust_traps_user_id_card_id_pk" PRIMARY KEY("user_id","card_id"),
	CONSTRAINT "joust_traps_trapped_check" CHECK ("joust_traps"."trapped" >= 0)
);
--> statement-breakpoint
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joust_traps" ADD CONSTRAINT "joust_traps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joust_traps" ADD CONSTRAINT "joust_traps_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wishes_card_idx" ON "wishes" USING btree ("card_id","seen_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "wishes_user_idx" ON "wishes" USING btree ("user_id","seen_at" DESC NULLS LAST);