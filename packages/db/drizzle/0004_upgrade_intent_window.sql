ALTER TABLE "payment_intent" ADD COLUMN "period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_intent" ADD COLUMN "expires_at" timestamp with time zone;