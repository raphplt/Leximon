CREATE TABLE "practice_answers" (
	"user_id" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"correct" boolean NOT NULL,
	"xp" smallint NOT NULL,
	"answered_at" timestamp with time zone NOT NULL,
	CONSTRAINT "practice_answers_user_id_idempotency_key_pk" PRIMARY KEY("user_id","idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "practice_answers" ADD CONSTRAINT "practice_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "practice_answers_user_answered_idx" ON "practice_answers" USING btree ("user_id","answered_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "practice_answers_answered_idx" ON "practice_answers" USING btree ("answered_at");