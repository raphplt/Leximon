CREATE TABLE "discord_links" (
	"user_id" text PRIMARY KEY NOT NULL,
	"discord_user_id" text NOT NULL,
	"username" text NOT NULL,
	"role_held" boolean DEFAULT false NOT NULL,
	"linked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "discord_links_discordUserId_unique" UNIQUE("discord_user_id")
);
--> statement-breakpoint
ALTER TABLE "discord_links" ADD CONSTRAINT "discord_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;