CREATE TABLE "patron_periods" (
	"invoice_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"plan" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"amount_paid" integer NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"refunded_at" timestamp with time zone,
	CONSTRAINT "patron_periods_plan_check" CHECK ("patron_periods"."plan" in ('monthly', 'yearly')),
	CONSTRAINT "patron_periods_amount_check" CHECK ("patron_periods"."amount_paid" > 0)
);
--> statement-breakpoint
CREATE TABLE "patron_subscriptions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"checkout_session_id" text,
	"stripe_subscription_id" text,
	"status" text,
	"plan" text,
	"current_period_end" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"cancel_at" timestamp with time zone,
	"trial_used_at" timestamp with time zone,
	"first_paid_at" timestamp with time zone,
	"founder_at" timestamp with time zone,
	"waiver_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patron_subscriptions_stripeCustomerId_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "patron_subscriptions_stripeSubscriptionId_unique" UNIQUE("stripe_subscription_id"),
	CONSTRAINT "patron_subscriptions_plan_check" CHECK ("patron_subscriptions"."plan" in ('monthly', 'yearly'))
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patron_periods" ADD CONSTRAINT "patron_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patron_subscriptions" ADD CONSTRAINT "patron_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patron_periods_user_idx" ON "patron_periods" USING btree ("user_id","starts_at");