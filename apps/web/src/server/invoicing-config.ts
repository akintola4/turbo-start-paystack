import { type InvoicingConfig, parseTaxRate } from "@workspace/billing";
import { env } from "@workspace/env/server";

/** Seller and VAT for new invoices, from INVOICE_* (see .env.example). */
export function invoicingFromEnv(): InvoicingConfig {
  return {
    seller: {
      name: env.INVOICE_SELLER_NAME ?? env.EMAIL_BRAND_NAME,
      // Env files can't hold real newlines; "\n" separates address lines.
      address: env.INVOICE_SELLER_ADDRESS?.replaceAll("\\n", "\n") ?? null,
      email: env.INVOICE_SELLER_EMAIL ?? null,
      taxId: env.INVOICE_SELLER_TAX_ID ?? null,
      vatNumber: env.INVOICE_SELLER_VAT_NUMBER ?? null,
    },
    taxRateBp: parseTaxRate(env.INVOICE_VAT_RATE),
  };
}
