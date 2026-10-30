/**
 * The landing FAQ. One source for the section and its FAQPage JSON-LD, so
 * the structured data always matches the visible text. Answers may wrap
 * commands and variables in backticks; the page renders those as code and
 * the JSON-LD gets the plain text.
 */

export type Faq = { question: string; answer: string };

export const FAQ: readonly Faq[] = [
  {
    question: "Is it really free?",
    answer:
      "Yes. It’s MIT-licensed: use it for your own product or client work and change anything. Paystack charges its usual transaction fees, and the starter adds nothing on top.",
  },
  {
    question: "Do I need a Paystack account to try it?",
    answer:
      "No. `pnpm setup` runs a local Paystack mock and seeds a demo organization, so you can subscribe, renew and fail a payment without any keys. You only need an account to take real payments.",
  },
  {
    question: "Which currencies can I bill in?",
    answer:
      "The plan catalog has prices in naira, cedis, rand, shillings and dollars. Set `BILLING_CURRENCY` to the one your Paystack account takes. Naira is the default.",
  },
  {
    question: "What if a webhook arrives twice, or out of order?",
    answer:
      "Each event is checked against Paystack’s signature and stored once, so a duplicate is acknowledged and ignored. Events are applied in order per customer, from the payload and Paystack’s API, so retries end in the same state. An hourly reconcile job catches anything that slipped through.",
  },
  {
    question: "Does it make invoices with VAT?",
    answer:
      "Every payment gets a numbered invoice (INV-2026-000123), with no gaps in the sequence, that customers can view, print or download as a PDF. Set `INVOICE_VAT_RATE` (7.5 in Nigeria) and invoices split the VAT out of your VAT-inclusive prices.",
  },
  {
    question: "Where can I deploy it?",
    answer:
      "Anywhere Node runs. There’s nothing Vercel-only: use Vercel with Neon or Supabase, or Railway, Fly or Docker. Paystack needs a stable public URL for webhooks, and something should call the reconcile route once an hour.",
  },
  {
    question: "Can I use Stripe or Flutterwave instead?",
    answer:
      "Not yet. Billing is built around Paystack today. Flutterwave and Stripe adapters behind the same billing interface are on the list for later.",
  },
];

/** An answer without its code marks, for structured data. */
export const plainAnswer = (answer: string) => answer.replaceAll("`", "");
