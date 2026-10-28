import {
  CURRENCIES,
  type Currency,
  formatMoney,
  getPlanPrice,
  planPriceId,
} from "@workspace/billing";
import { Button } from "@workspace/ui/components/button";
import { CircleCheckIcon } from "lucide-react";
import Link from "next/link";

import { Monogram } from "@/components/shared/avatars";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Money, Pill, Wordmark } from "./ui";

const CURRENCY_NAME: Record<Currency, string> = {
  NGN: "Naira",
  GHS: "Cedi",
  ZAR: "Rand",
  KES: "Shilling",
  USD: "Dollar",
};

function price(plan: "starter" | "pro", currency: Currency) {
  const p = getPlanPrice(planPriceId(plan, "monthly", currency));
  return p ? formatMoney(p.amountSubunit, p.currency) : "";
}

export function LandingNav() {
  return (
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
      <Link
        aria-label="Turbo Start Paystack home"
        className="flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href="/"
      >
        <Wordmark />
      </Link>
      <nav className="flex items-center gap-1">
        <ThemeToggle className="hidden size-9 text-muted-foreground sm:inline-flex" />
        <Button asChild className="hidden sm:inline-flex" variant="ghost">
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild>
          <Link href="/sign-up">Create account</Link>
        </Button>
      </nav>
    </header>
  );
}

function Statement() {
  const pro = price("pro", "NGN");
  const events = [
    { name: "charge.success", note: "Signature verified", time: "09:02:11" },
    { name: "subscription.create", note: "Pro, monthly", time: "09:02:12" },
    { name: "invoice.update", note: "Marked paid", time: "09:02:14" },
  ];
  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_oklch(0.2_0.02_260/0.05),0_12px_32px_-12px_oklch(0.2_0.02_260/0.12)]">
        <div className="flex items-center justify-between gap-4 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Monogram
              className="size-8"
              name="Kola Logistics"
              seed="kola-logistics"
              tone="solid"
            />
            <div className="grid leading-tight">
              <span className="font-medium text-sm">Kola Logistics</span>
              <span className="text-muted-foreground text-xs">
                Invoice for October
              </span>
            </div>
          </div>
          <Pill tone="positive">Paid</Pill>
        </div>
        <dl className="grid gap-3 px-6 py-5 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt>
              Pro, monthly
              <span className="block text-muted-foreground text-xs">
                12 Oct to 12 Nov 2026
              </span>
            </dt>
            <dd className="font-medium">
              <Money label={pro} />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 text-muted-foreground">
            <dt>Card</dt>
            <dd>Visa •••• 4081</dd>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-4 border-t pt-4">
            <dt className="font-medium">Total</dt>
            <dd className="font-semibold text-lg tracking-tight">
              <Money label={pro} quiet={false} />
            </dd>
          </div>
        </dl>
        <div className="border-t bg-background/60 px-6 py-4">
          <p className="mb-3 font-medium text-muted-foreground text-xs">
            Recorded from Paystack webhooks
          </p>
          <ol className="grid gap-2.5">
            {events.map((e) => (
              <li className="flex items-center gap-3 text-sm" key={e.name}>
                <CircleCheckIcon
                  aria-hidden
                  className="size-4 shrink-0 text-success"
                />
                <span className="font-mono text-[13px]">{e.name}</span>
                <span className="hidden truncate text-muted-foreground sm:inline">
                  {e.note}
                </span>
                <span className="ml-auto font-mono text-muted-foreground text-xs tabular-nums">
                  {e.time}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

const FACTS = [
  {
    title: "Organizations and roles",
    body: "Owners, admins, billing managers, members and viewers. Invitations work only for the address they were sent to and expire after 7 days.",
  },
  {
    title: "Paystack subscriptions",
    body: "Prorated upgrades, downgrades at the end of the period, 14-day trials with a card on file, and a 7-day grace period when a renewal fails.",
  },
  {
    title: "State from verified webhooks",
    body: "Plans, statuses and amounts are written only by signed webhooks and server-side verification. The browser never sends them.",
  },
];

export function LedgerLanding() {
  return (
    <div className="min-h-dvh bg-card">
      <LandingNav />
      <main>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pt-16 pb-24 lg:grid-cols-[minmax(0,1fr)_27rem] lg:gap-20 lg:pt-24">
          <div className="grid max-w-xl gap-6">
            <h1 className="text-balance font-display font-semibold text-4xl leading-[1.08] tracking-[-0.025em] sm:text-5xl">
              Ship B2B SaaS that bills in naira, cedis, rand and shillings.
            </h1>
            <p className="max-w-lg text-pretty text-lg text-muted-foreground leading-relaxed">
              An open-source Next.js starter with organizations, roles and
              invitations, and Paystack subscriptions driven by verified
              webhooks, not by the browser.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg">
                <Link href="/sign-up">Create an account</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="https://github.com/akintola4/turbo-start-paystack">
                  View the source
                </a>
              </Button>
            </div>
          </div>
          <Statement />
        </section>

        <section className="border-y bg-background">
          <div className="mx-auto grid w-full max-w-6xl md:grid-cols-3 md:divide-x">
            {FACTS.map((f) => (
              <div
                className="grid content-start gap-2 border-b px-6 py-10 last:border-b-0 md:border-b-0 md:px-8 md:first:pl-6"
                key={f.title}
              >
                <h2 className="font-semibold text-[15px] tracking-tight">
                  {f.title}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-20 lg:grid-cols-[minmax(0,1fr)_27rem] lg:gap-20">
          <div className="grid content-start gap-3">
            <h2 className="font-display font-semibold text-2xl tracking-tight">
              Five currencies, one catalog
            </h2>
            <p className="max-w-md text-muted-foreground leading-relaxed">
              Prices are stored as integer subunits with an ISO currency. Each
              organization locks its currency at the first checkout.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <caption className="sr-only">Monthly prices by currency</caption>
              <thead>
                <tr className="border-b bg-background text-muted-foreground">
                  <th className="h-10 px-4 text-left font-medium" scope="col">
                    Currency
                  </th>
                  <th className="h-10 px-4 text-right font-medium" scope="col">
                    Starter
                  </th>
                  <th className="h-10 px-4 text-right font-medium" scope="col">
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {CURRENCIES.map((c) => (
                  <tr key={c}>
                    <th className="h-11 px-4 text-left font-normal" scope="row">
                      <span className="font-medium">{c}</span>
                      <span className="ml-2 hidden text-muted-foreground sm:inline">
                        {CURRENCY_NAME[c]}
                      </span>
                    </th>
                    <td className="px-4 text-right">
                      <Money label={price("starter", c)} />
                    </td>
                    <td className="px-4 text-right">
                      <Money label={price("pro", c)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <footer className="border-t">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 text-muted-foreground text-sm">
          <span>MIT licensed</span>
          <a
            className="underline-offset-4 hover:text-foreground hover:underline"
            href="https://github.com/akintola4/turbo-start-paystack"
          >
            akintola4/turbo-start-paystack
          </a>
        </div>
      </footer>
    </div>
  );
}
