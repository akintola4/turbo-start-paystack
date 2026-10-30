// pnpm payloads:redact
// One-off: seals Paystack authorization codes and email tokens left in plain
// text in webhook_event.payload, and redacts them from invoice.raw. Rows
// stored after this change are already clean. Safe to re-run.
import { redactStoredPayloads } from "@workspace/billing";
import { createDb } from "@workspace/db";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const db = createDb(required("DATABASE_URL"), { max: 1 });
const report = await redactStoredPayloads(
  db,
  required("BILLING_ENCRYPTION_KEY")
);
console.log(`webhook events sealed: ${report.webhookEvents}`);
console.log(`invoices redacted:     ${report.invoices}`);
process.exit(0);
