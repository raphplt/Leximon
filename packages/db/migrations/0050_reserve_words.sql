CREATE TABLE "reserve_words" (
	"id" text PRIMARY KEY NOT NULL,
	"word" text NOT NULL,
	"definition" text NOT NULL,
	"theme" text,
	"part_of_speech" text,
	"search_key" text NOT NULL,
	"release" text NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "word_finds" (
	"word_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"state" text NOT NULL,
	"found_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "word_finds_state_check" CHECK ("word_finds"."state" in ('reserved', 'published', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "word_finds" ADD CONSTRAINT "word_finds_word_id_reserve_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."reserve_words"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_finds" ADD CONSTRAINT "word_finds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reserve_words_search_idx" ON "reserve_words" USING btree ("search_key" text_pattern_ops) WHERE "reserve_words"."removed_at" is null;--> statement-breakpoint
CREATE INDEX "reserve_words_theme_idx" ON "reserve_words" USING btree ("theme","search_key") WHERE "reserve_words"."removed_at" is null;--> statement-breakpoint
CREATE INDEX "word_finds_user_idx" ON "word_finds" USING btree ("user_id","found_at");