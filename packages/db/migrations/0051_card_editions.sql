CREATE TABLE "card_editions" (
	"user_id" text NOT NULL,
	"card_id" text NOT NULL,
	"edition" text,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "card_editions_user_id_card_id_pk" PRIMARY KEY("user_id","card_id")
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "card_edition" text;--> statement-breakpoint
ALTER TABLE "card_editions" ADD CONSTRAINT "card_editions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_editions" ADD CONSTRAINT "card_editions_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;