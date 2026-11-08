ALTER TYPE "public"."ecu_movement_kind" ADD VALUE 'banner';--> statement-breakpoint
CREATE TABLE "user_banners" (
	"user_id" text NOT NULL,
	"motif" text NOT NULL,
	"bought_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_banners_user_id_motif_pk" PRIMARY KEY("user_id","motif")
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "banner_motif" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "banner_tint" text;--> statement-breakpoint
ALTER TABLE "user_banners" ADD CONSTRAINT "user_banners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;