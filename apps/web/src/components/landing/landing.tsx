import { CURRENCIES, catalog } from "@workspace/billing";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { BadgeCheckIcon, Building2Icon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";

import { formatMoney } from "@/lib/money";

import {
  type CurrencyTable,
  CurrencyPicker,
} from "@/components/landing/currency-picker";
import { GLYPHS, GlyphMosaic, Wordmark } from "@/components/primitives";

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
          monthly: monthly ? formatMoney(monthly.amountSubunit, code) : null,
          trialDays: plan.trialDays,
          features: [...plan.features],
        };
      }),
    };
  });
}

const FEATURES = [
  {
    icon: Building2Icon,
    title: "Organizations and roles",
    body: "Owners, admins, billing managers, members and viewers. Invitations only work for the address they were sent to.",
  },
  {
    icon: RefreshCwIcon,
    title: "Subscriptions that behave",
    body: "Card-up-front trials, prorated upgrades, downgrades at period end, and a 7-day grace period when a renewal fails.",
  },
  {
    icon: BadgeCheckIcon,
    title: "State from verified webhooks",
    body: "Plan status changes only after a signed Paystack event or a server-side verify. The browser never decides.",
  },
];

export function Landing() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6">
        <Wordmark />
        <nav aria-label="Account" className="flex items-center gap-2">
          <Link
            className={buttonVariants({ variant: "ghost" })}
            href="/sign-in"
          >
            Sign in
          </Link>
          <Link
            className={buttonVariants({
              className: "hidden rounded-full px-5 sm:inline-flex",
            })}
            href="/sign-up"
          >
            Create account
          </Link>
        </nav>
      </header>

      <main className="mx-auto grid max-w-6xl gap-16 px-4 pt-10 pb-24 sm:gap-20 sm:px-6 sm:pt-16">
        <section className="grid gap-10 md:grid-cols-[minmax(0,1fr)_22rem] md:items-center lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16">
          <div className="animate-rise grid content-center gap-8">
            <h1 className="text-balance font-display font-semibold text-[44px] leading-[1.02] tracking-[-0.02em] sm:text-[64px]">
              Bill teams across Africa in their own money.
            </h1>
            <p className="max-w-[34rem] text-pretty text-lg text-muted-foreground leading-relaxed">
              An open-source SaaS starter with organizations, roles and Paystack
              subscriptions in naira, cedis, rand, shillings and dollars.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                className={buttonVariants({
                  className: "h-11 rounded-full px-6 text-[15px]",
                })}
                href="/sign-up"
              >
                Start a workspace
              </Link>
              <a
                className={buttonVariants({
                  variant: "outline",
                  className: "h-11 rounded-full px-6 text-[15px]",
                })}
                href="https://github.com/akintola4/turbo-start-paystack"
              >
                Read the code
              </a>
            </div>
          </div>
          <div className="hidden rounded-[28px] bg-hero p-5 md:block">
            <GlyphMosaic />
          </div>
        </section>

        <section
          aria-label="Example plans"
          className="animate-rise rounded-[28px] bg-canvas p-4 [animation-delay:80ms] sm:p-6"
        >
          <CurrencyPicker table={currencyTable()} />
        </section>

        <section aria-labelledby="features-title" className="grid gap-8">
          <h2
            className="max-w-[24ch] text-balance font-display font-semibold text-[28px] leading-tight tracking-tight sm:text-[32px]"
            id="features-title"
          >
            The billing parts you would otherwise write yourself.
          </h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li
                className="grid content-start gap-4 rounded-[20px] border bg-card p-6"
                key={title}
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon aria-hidden className="size-5" />
                </span>
                <div className="grid gap-1.5">
                  <h3 className="font-display font-semibold text-lg">
                    {title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-muted-foreground text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Open source under the MIT license.</p>
          <a
            className="rounded underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            href="https://github.com/akintola4/turbo-start-paystack"
          >
            github.com/akintola4/turbo-start-paystack
          </a>
        </div>
      </footer>
    </div>
  );
}
