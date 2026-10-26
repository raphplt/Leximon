CREATE TABLE "user_rarity_completions" (
	"user_id" text NOT NULL,
	"collection_id" text NOT NULL,
	"rarity" "rarity" NOT NULL,
	"xp" integer NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_rarity_completions_user_id_collection_id_rarity_pk" PRIMARY KEY("user_id","collection_id","rarity")
);
--> statement-breakpoint
ALTER TABLE "user_rarity_completions" ADD CONSTRAINT "user_rarity_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_rarity_completions" ADD CONSTRAINT "user_rarity_completions_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;