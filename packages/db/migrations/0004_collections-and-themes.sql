CREATE TABLE "card_themes" (
	"card_id" text NOT NULL,
	"theme_id" text NOT NULL,
	CONSTRAINT "card_themes_card_id_theme_id_pk" PRIMARY KEY("card_id","theme_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booster_opens" ADD COLUMN "collection_id" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "collection_id" text;--> statement-breakpoint
-- Cards created before collections existed are gathered in an unpublished collection. No-op on an
-- empty catalog; only local development data is concerned.
INSERT INTO "collections" ("id", "name") SELECT 'non-classees', 'Non classées' WHERE EXISTS (SELECT 1 FROM "cards");--> statement-breakpoint
UPDATE "cards" SET "collection_id" = 'non-classees' WHERE "collection_id" IS NULL;--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "collection_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "card_themes" ADD CONSTRAINT "card_themes_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_themes" ADD CONSTRAINT "card_themes_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_themes_theme_idx" ON "card_themes" USING btree ("theme_id");--> statement-breakpoint
ALTER TABLE "booster_opens" ADD CONSTRAINT "booster_opens_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_collection_drawable_idx" ON "cards" USING btree ("collection_id","rarity") WHERE "cards"."retired_at" is null;