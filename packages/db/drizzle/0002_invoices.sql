CREATE TYPE "public"."invoice_kind" AS ENUM('subscription', 'renewal', 'proration', 'card_check');--> statement-breakpoint
CREATE TABLE "billing_details" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"legal_name" text,
	"address" text,
	"tax_id" text,
	"email" text,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_sequence" (
	"scope" text PRIMARY KEY NOT NULL,
	"last_value" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "kind" "invoice_kind";--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "plan_price_id" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "card_brand" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "card_last4" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "number" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "issued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "seller" jsonb;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "buyer" jsonb;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "tax_rate_bp" integer;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "net_subunit" bigint;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "tax_subunit" bigint;--> statement-breakpoint
ALTER TABLE "billing_details" ADD CONSTRAINT "billing_details_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_plan_price_id_plan_price_id_fk" FOREIGN KEY ("plan_price_id") REFERENCES "public"."plan_price"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_number_unique" UNIQUE("number");--> statement-breakpoint
-- Backfill rows written before invoice kinds and numbers existed.
UPDATE "invoice" SET "kind" = CASE
  WHEN "description" ILIKE 'Card verification%' THEN 'card_check'::"invoice_kind"
  WHEN "description" ILIKE 'Plan upgrade%' THEN 'proration'::"invoice_kind"
  WHEN "description" = 'Renewal' OR "paystack_invoice_code" IS NOT NULL THEN 'renewal'::"invoice_kind"
  ELSE 'subscription'::"invoice_kind"
END;--> statement-breakpoint
UPDATE "invoice" i SET
  "plan_price_id" = s."plan_price_id",
  "card_brand" = s."card_brand",
  "card_last4" = s."card_last4"
FROM "subscription" s
WHERE i."subscription_id" = s."id";--> statement-breakpoint
UPDATE "invoice" SET "refunded_at" = coalesce("paid_at", "created_at") WHERE "status" = 'void';--> statement-breakpoint
WITH numbered AS (
  SELECT "id",
    'INV-' || to_char("paid_at" AT TIME ZONE 'UTC', 'YYYY') AS scope,
    row_number() OVER (
      PARTITION BY to_char("paid_at" AT TIME ZONE 'UTC', 'YYYY')
      ORDER BY "paid_at", "id"
    ) AS n
  FROM "invoice"
  WHERE "status" = 'paid' AND "kind" <> 'card_check' AND "paid_at" IS NOT NULL
)
UPDATE "invoice" i SET
  "number" = numbered.scope || '-' || lpad(numbered.n::text, 6, '0'),
  "issued_at" = i."paid_at"
FROM numbered
WHERE i."id" = numbered."id";--> statement-breakpoint
INSERT INTO "invoice_sequence" ("scope", "last_value")
SELECT substring("number" from 1 for 8), count(*)
FROM "invoice"
WHERE "number" IS NOT NULL
GROUP BY 1;
