CREATE TYPE "public"."guest_link_outcome" AS ENUM('transfer', 'abandon');--> statement-breakpoint
CREATE TABLE "guest_links" (
	"guest_id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"outcome" "guest_link_outcome" NOT NULL,
	"cards" integer NOT NULL,
	"words" integer NOT NULL,
	"linked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "guest_links_not_self_check" CHECK ("guest_links"."guest_id" <> "guest_links"."account_id"),
	CONSTRAINT "guest_links_counts_check" CHECK ("guest_links"."cards" >= 0 and "guest_links"."words" >= 0)
);
--> statement-breakpoint
ALTER TABLE "guest_links" ADD CONSTRAINT "guest_links_guest_id_users_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_links" ADD CONSTRAINT "guest_links_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_links_account_idx" ON "guest_links" USING btree ("account_id");