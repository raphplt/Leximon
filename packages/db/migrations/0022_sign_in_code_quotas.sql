CREATE TABLE "sign_in_code_quotas" (
	"email_key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"sent" integer NOT NULL
);
