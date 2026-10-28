// pnpm webhook:replay fixtures/charge-success.json [--url=http://localhost:3000/api/webhooks/paystack]
// Signs a JSON payload with PAYSTACK_SECRET_KEY and POSTs it to the webhook
// route, exactly as Paystack would. Edit the fixture's reference/codes to
// match rows in your database first.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { signPaystackPayload } from "@workspace/billing";

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: pnpm webhook:replay <payload.json> [--url=…]");
  process.exit(1);
}
const url =
  process.argv.find((a) => a.startsWith("--url="))?.slice(6) ??
  "http://localhost:3000/api/webhooks/paystack";
const secret = process.env.PAYSTACK_SECRET_KEY;
if (!secret) {
  console.error("PAYSTACK_SECRET_KEY is required (it is the webhook HMAC key)");
  process.exit(1);
}

// Re-serialise so the signature matches the exact bytes sent.
const body = JSON.stringify(JSON.parse(readFileSync(resolve(file), "utf8")));
const res = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-paystack-signature": signPaystackPayload(body, secret),
  },
  body,
});
console.log(`${res.status} ${await res.text()}`);
