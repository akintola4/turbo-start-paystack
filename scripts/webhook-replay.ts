// pnpm webhook:replay scripts/fixtures/charge-success.json [--url=<webhook url>]
// Signs a JSON payload with PAYSTACK_SECRET_KEY and POSTs it to the webhook
// route, exactly as Paystack would. The path is relative to the repo root
// (pnpm runs this from scripts/, and the root script's nested pnpm sets
// INIT_CWD to the root). The URL defaults to BETTER_AUTH_URL's
// /api/webhooks/paystack, and must be local unless you pass --url. The
// fixtures hold placeholder references and codes: edit them to match rows in
// your database first, or the event is stored and matches nothing.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { signPaystackPayload } from "@workspace/billing";

import { replayTarget } from "./targets";

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: pnpm webhook:replay <payload.json> [--url=…]");
  process.exit(1);
}
const secret = process.env.PAYSTACK_SECRET_KEY;
if (!secret) {
  console.error("PAYSTACK_SECRET_KEY is required (it is the webhook HMAC key)");
  process.exit(1);
}
const target = replayTarget(process.argv.slice(2), process.env);
if ("error" in target) {
  console.error(target.error);
  process.exit(1);
}

// Re-serialise so the signature matches the exact bytes sent.
const body = JSON.stringify(
  JSON.parse(
    readFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), file), "utf8")
  )
);
console.log(`POST ${target.url}`);
const res = await fetch(target.url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-paystack-signature": signPaystackPayload(body, secret),
  },
  body,
});
console.log(`${res.status} ${await res.text()}`);
process.exit(res.ok ? 0 : 1);
