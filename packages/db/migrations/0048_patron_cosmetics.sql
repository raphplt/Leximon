CREATE TABLE "patron_cosmetic_claims" (
	"user_id" text NOT NULL,
	"month" text NOT NULL,
	"cosmetic" jsonb NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "patron_cosmetic_claims_user_id_month_pk" PRIMARY KEY("user_id","month")
);
--> statement-breakpoint
ALTER TABLE "patron_cosmetic_claims" ADD CONSTRAINT "patron_cosmetic_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;