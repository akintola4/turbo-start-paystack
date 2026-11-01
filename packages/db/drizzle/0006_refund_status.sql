CREATE TYPE "public"."refund_status" AS ENUM('pending', 'processed', 'failed', 'needs_attention');--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "refund_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "refund_status" "refund_status";--> statement-breakpoint
-- Until now refunded_at was set when Paystack accepted the refund request.
-- Keep that as the request date, then derive each void row's state from the
-- refund webhooks stored for its charge, as service/refunds.ts does.
UPDATE "invoice" SET "refund_requested_at" = "refunded_at" WHERE "status" = 'void' AND "refunded_at" IS NOT NULL;--> statement-breakpoint
UPDATE "invoice" AS i SET "refund_status" = (
	SELECT CASE
		WHEN bool_or(e."event_type" = 'refund.processed') THEN 'processed'
		WHEN bool_or(e."event_type" = 'refund.failed') THEN 'failed'
		WHEN bool_or(e."event_type" = 'refund.needs-attention') THEN 'needs_attention'
		WHEN i."refund_requested_at" IS NOT NULL OR count(e."id") > 0 THEN 'pending'
		ELSE 'failed'
	END::"refund_status"
	FROM "webhook_event" AS e
	WHERE e."event_type" LIKE 'refund.%' AND e."payload"->'data'->>'transaction_reference' = i."reference"
) WHERE i."status" = 'void';--> statement-breakpoint
UPDATE "invoice" SET "refunded_at" = NULL WHERE "status" = 'void' AND "refund_status" <> 'processed';
