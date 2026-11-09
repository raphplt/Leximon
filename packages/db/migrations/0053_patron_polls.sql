CREATE TABLE "patron_poll_votes" (
	"poll_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"theme" integer NOT NULL,
	"voted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "patron_poll_votes_poll_id_user_id_pk" PRIMARY KEY("poll_id","user_id"),
	CONSTRAINT "patron_poll_votes_theme_check" CHECK ("patron_poll_votes"."theme" >= 0)
);
--> statement-breakpoint
CREATE TABLE "patron_polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"themes" jsonb NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patron_poll_votes" ADD CONSTRAINT "patron_poll_votes_poll_id_patron_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."patron_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patron_poll_votes" ADD CONSTRAINT "patron_poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patron_polls" ADD CONSTRAINT "patron_polls_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patron_poll_votes_theme_idx" ON "patron_poll_votes" USING btree ("poll_id","theme");--> statement-breakpoint
CREATE INDEX "patron_polls_opens_idx" ON "patron_polls" USING btree ("opens_at");