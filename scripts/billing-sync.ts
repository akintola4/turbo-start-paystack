// pnpm billing:sync [--currencies=NGN,USD]
// Creates one Paystack plan per catalog price for the given currencies
// (default: BILLING_CURRENCY) and stores the plan codes. Safe to re-run.
import {
  type Currency,
  createPaystackClient,
  isCurrency,
  syncPlans,
} from "@workspace/billing";
import { createDb } from "@workspace/db";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const arg = process.argv.find((a) => a.startsWith("--currencies="));
const currencies = (arg?.split("=")[1] ?? process.env.BILLING_CURRENCY ?? "NGN")
  .split(",")
  .map((c) => c.trim().toUpperCase())
  .filter((c): c is Currency => isCurrency(c));

const secretKey = required("PAYSTACK_SECRET_KEY");
const db = createDb(required("DATABASE_URL"), { max: 1 });
const paystack = createPaystackClient({
  secretKey,
  baseUrl: process.env.PAYSTACK_API_URL ?? "https://api.paystack.co",
});

console.log(
  `Syncing ${currencies.join(", ")} plans to Paystack (${secretKey.startsWith("sk_live_") ? "LIVE" : "test"} mode)…`
);
const report = await syncPlans({ db, paystack, currencies });
console.log(`created:   ${report.created.join(", ") || "none"}`);
console.log(`adopted:   ${report.adopted.join(", ") || "none"}`);
console.log(`unchanged: ${report.unchanged.join(", ") || "none"}`);
process.exit(0);
