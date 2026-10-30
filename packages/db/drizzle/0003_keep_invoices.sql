ALTER TABLE "invoice" DROP CONSTRAINT "invoice_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT "invoice_subscription_id_subscription_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE set null ON UPDATE no action;