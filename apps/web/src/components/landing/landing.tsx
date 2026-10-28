import { CURRENCIES, catalog } from "@workspace/billing";
import { buttonVariants } from "@workspace/ui/components/button";
import Link from "next/link";

import { formatMoney } from "@/lib/money";

import {
  CurrencyShowcase,
  type CurrencyTable,
} from "@/components/landing/currency-picker";
import {
  GLYPHS,
  Money,
  Panel,
  StatusBadge,
  Wordmark,
} from "@/components/primitives";

function currencyTable(): CurrencyTable {
  return CURRENCIES.map((code) => {
    const meta = GLYPHS.find((g) => g.code === code);
    return {
      code,
      glyph: meta?.glyph ?? code,
      name: meta?.name ?? code,
      plans: catalog.map((plan) => {
        const monthly = plan.prices.find(
          (p) => p.currency === code && p.interval === "monthly"
        );
        return {
          key: plan.key,
          name: plan.name,
          description: plan.description,
          monthly: formatMoney(monthly?.amountSubunit ?? 0, code),
          trialDays: plan.trialDays,
          features: [...plan.features],
        };
      }),
    };
  });
}

/** What you get, as a short list next to the real panel it produces. */
const PARTS = [
  [
    "Organizations and roles",
    "Owner, admin, billing, member and viewer. Invitations only work for the address they were sent to and expire after 7 days.",
  ],
  [
    "Checkout on Paystack",
    "Hosted page or inline popup. The server creates the transaction; the browser only gets an access code.",
  ],
  [
    "Trials, upgrades and downgrades",
    "Card-up-front 14-day trials, prorated upgrades now, downgrades at the end of the period.",
  ],
  [
    "State from verified webhooks",
    "Signed, deduplicated and processed in order per customer. Nothing the browser sends changes a plan.",
  ],
  [
    "Failed renewals",
    "Seven days of grace, a banner with one fix, and an email with Paystack's card link.",
  ],
  [
    "Five currencies",
    "Naira, cedis, rand, shillings and dollars, stored as integer subunits.",
  ],
] as const;

export function Landing() {
  const table = currencyTable();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5 sm:px-8">
        <Wordmark />
        <nav aria-label="Account" className="flex items-center gap-2">
          <Link
            className={buttonVariants({ variant: "ghost" })}
            href="/sign-in"
          >
            Sign in
          </Link>
          <Link
            className={buttonVariants({ className: "max-sm:hidden" })}
            href="/sign-up"
          >
            Create account
          </Link>
        </nav>
      </header>
      <main
        className="mx-auto grid w-full max-w-[1120px] gap-12 px-4 pt-8 pb-24 sm:gap-16 sm:px-8 sm:pt-14 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:gap-x-12 lg:grid-cols-[minmax(0,1fr)_26rem]"
        id="content"
      >
        <section className="grid animate-rise content-center gap-8">
          <h1 className="text-balance font-semibold text-[40px] leading-[1.05] tracking-[-0.03em] sm:text-[60px]">
            Bill teams across Africa in their own money.
          </h1>
          <p className="max-w-[34rem] text-pretty text-lg text-muted-foreground">
            An open-source Next.js starter with organizations, roles and
            Paystack subscriptions in naira, cedis, rand, shillings and dollars.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link className={buttonVariants({ size: "lg" })} href="/sign-up">
              Start a workspace
            </Link>
            <a
              className={buttonVariants({ variant: "outline", size: "lg" })}
              href="https://github.com/akintola4/turbo-start-paystack"
            >
              Read the code
            </a>
          </div>
        </section>
        <CurrencyShowcase table={table} />
        <section
          aria-labelledby="parts-title"
          className="grid gap-8 md:col-span-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start"
        >
          <div className="grid gap-6">
            <h2
              className="max-w-[22ch] font-semibold text-[28px] leading-tight tracking-[-0.02em]"
              id="parts-title"
            >
              The billing parts you would otherwise write yourself
            </h2>
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {PARTS.map(([title, body]) => (
                <div
                  className="grid gap-1 border-border border-t pt-4"
                  key={title}
                >
                  <dt className="font-semibold">{title}</dt>
                  <dd className="text-muted-foreground text-sm">{body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <figure className="grid gap-3">
            <Panel as="div" className="grid gap-6">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xl">Pro plan</span>
                <StatusBadge status="active" />
              </div>
              <Money
                label={formatMoney(3_000_000, "NGN")}
                per="month"
                size="xl"
              />
              <dl className="grid gap-2 rounded-card bg-panel-tile p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-panel-muted">Next charge</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatMoney(3_000_000, "NGN")} on 12 Nov
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-panel-muted">Seats</dt>
                  <dd className="font-semibold tabular-nums">6 of 50</dd>
                </div>
              </dl>
            </Panel>
            <figcaption className="text-muted-foreground text-sm">
              The billing panel your customers get: plan, status, next charge
              and seats, written only by verified Paystack webhooks.
            </figcaption>
          </figure>
        </section>
      </main>
      <footer className="border-border border-t">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-muted-foreground text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>Open source under the MIT license.</p>
          <a
            className="rounded-chip text-link underline-offset-4 hover:underline"
            href="https://github.com/akintola4/turbo-start-paystack"
          >
            github.com/akintola4/turbo-start-paystack
          </a>
        </div>
      </footer>
    </div>
  );
}
