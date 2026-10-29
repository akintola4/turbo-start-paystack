import { CURRENCIES, catalog } from "@workspace/billing";
import type { Currency } from "@workspace/billing/money";
import { buttonVariants } from "@workspace/ui/components/button";
import { ArrowUpRightIcon, GitForkIcon } from "lucide-react";

import { LandingProvider } from "@/components/landing/currency-context";
import { Hero } from "@/components/landing/hero";
import { Pricing } from "@/components/landing/pricing";
import { ReceiptSection } from "@/components/landing/receipt-section";
import { type BuildInfo, SiteFooter } from "@/components/landing/site-footer";
import { StartCommand } from "@/components/landing/start-command";
import type { PlanInfo, PriceTable } from "@/components/landing/types";
import { WebhookDemo } from "@/components/landing/webhook-demo";
import { formatUpdated } from "@/lib/landing";

const REPO = "https://github.com/akintola4/turbo-start-paystack";

function priceTable(): PriceTable {
  const amount = (
    key: "starter" | "pro",
    code: string,
    interval: "monthly" | "annually"
  ) =>
    catalog
      .find((p) => p.key === key)
      ?.prices.find((p) => p.currency === code && p.interval === interval)
      ?.amountSubunit ?? 0;
  return Object.fromEntries(
    CURRENCIES.map((code) => [
      code,
      {
        starter: {
          monthly: amount("starter", code, "monthly"),
          annually: amount("starter", code, "annually"),
        },
        pro: {
          monthly: amount("pro", code, "monthly"),
          annually: amount("pro", code, "annually"),
        },
      },
    ])
  ) as PriceTable;
}

const PLANS: PlanInfo[] = catalog.map((p) => ({
  key: p.key,
  name: p.name,
  description: p.description,
  trialDays: p.trialDays,
  features: [...p.features],
}));

/** Version and last-commit date, injected by next.config.ts at build time. */
const BUILD: BuildInfo = {
  version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
  updated: formatUpdated(process.env.NEXT_PUBLIC_LAST_UPDATED),
};

const FEATURES = [
  {
    title: "Organizations and roles",
    body: "Owner, admin, billing, member and viewer. An invitation only works for the address it was sent to, and it expires after 7 days.",
    path: "packages/auth/src/server.ts",
  },
  {
    title: "Checkout on Paystack",
    body: "Hosted page or inline popup. Your server creates the transaction; the browser only ever gets an access code.",
    path: "packages/billing/src/service/checkout.ts",
  },
  {
    title: "Trials, upgrades and downgrades",
    body: "14-day trials with the card saved up front. Upgrades charge the prorated difference now; downgrades wait for the end of the period.",
    path: "packages/billing/src/proration.ts",
  },
  {
    title: "Failed renewals",
    body: "Seven days of grace, one banner with one fix, and an email with Paystack’s card update link.",
    path: "packages/billing/src/reconcile.ts",
  },
  {
    title: "Five currencies, stored as integers",
    body: "Naira, cedis, rand, shillings and dollars in subunits. billing:sync turns the catalog into 20 Paystack plans.",
    path: "packages/billing/src/catalog.ts",
  },
  {
    title: "Receipts and reminders",
    body: "React Email templates for receipts, trial endings and failed payments, with a local preview.",
    path: "packages/email/src/templates",
  },
];

export function Landing({ initialCurrency }: { initialCurrency: Currency }) {
  const prices = priceTable();
  return (
    <LandingProvider initialCurrency={initialCurrency}>
      {/* Padding, not the hero's margin: a top margin would collapse
          through <body> and shift the page once hydration settles. */}
      <div className="pt-2 sm:pt-3">
        <Hero prices={prices} />
      </div>
      <main
        className="grid grid-cols-[minmax(0,1fr)] gap-24 pt-24 sm:gap-32 sm:pt-32"
        id="content"
      >
        <section
          aria-labelledby="webhooks-title"
          className="mx-auto grid w-full max-w-[1312px] scroll-mt-8 gap-10 px-4 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
          id="webhooks"
        >
          <div className="grid min-w-0 content-start gap-6">
            <h2
              className="text-balance font-semibold text-[clamp(36px,4.4vw,64px)] leading-[0.96] tracking-[-0.045em]"
              id="webhooks-title"
            >
              Only signed events change a plan.
            </h2>
            <p className="max-w-[34rem] text-pretty text-lg text-muted-foreground">
              Paystack signs every event it sends. The starter checks that
              signature, stores each event once and applies them in order per
              customer. The browser can start a checkout, but it can’t change
              what anyone pays. Send a few events and see.
            </p>
            <div className="max-w-full overflow-x-auto rounded-card bg-secondary p-4 font-mono text-[13px] leading-relaxed">
              <p className="text-muted-foreground">
                {"// packages/billing/src/webhook/verify.ts"}
              </p>
              <p className="whitespace-pre">
                {
                  'createHmac("sha512", secretKey)\n  .update(rawBody, "utf8")\n  .digest("hex") === signature'
                }
              </p>
            </div>
          </div>
          <WebhookDemo />
        </section>

        <Pricing plans={PLANS} prices={prices} />

        <section
          aria-labelledby="features-title"
          className="mx-auto grid w-full max-w-[1312px] gap-10 px-4 sm:px-8"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end">
            <h2
              className="max-w-[16ch] text-balance font-semibold text-[clamp(36px,5vw,72px)] leading-[0.96] tracking-[-0.045em]"
              id="features-title"
            >
              The billing you’d otherwise write yourself.
            </h2>
            <p className="text-pretty text-muted-foreground">
              Each part lives in a file you can read before you trust it.
            </p>
          </div>
          <ul className="border-foreground border-t">
            {FEATURES.map((f) => (
              <li
                className="grid gap-2 border-border border-b py-5 md:grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,4fr)] md:items-baseline md:gap-6"
                key={f.title}
              >
                <h3 className="font-semibold text-[clamp(19px,1.8vw,24px)] leading-tight tracking-[-0.02em]">
                  {f.title}
                </h3>
                <p className="text-pretty text-muted-foreground">{f.body}</p>
                <a
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 justify-self-start rounded-chip font-mono text-[13px] text-link underline-offset-4 hover:underline md:justify-self-end"
                  href={`${REPO}/blob/main/${f.path}`}
                >
                  <span className="truncate">{f.path}</span>
                  <ArrowUpRightIcon aria-hidden className="size-3.5 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="start-title"
          className="mx-auto grid w-full max-w-[1312px] scroll-mt-8 gap-6 px-4 sm:gap-8 sm:px-8"
          id="start"
        >
          <h2
            className="text-balance font-semibold text-[clamp(40px,6vw,96px)] leading-[0.94] tracking-[-0.05em]"
            id="start-title"
          >
            One command to start.
          </h2>
          <StartCommand />
          <div className="flex flex-wrap gap-2.5">
            <a className={buttonVariants({ size: "lg" })} href={REPO}>
              <GitForkIcon aria-hidden />
              Open on GitHub
            </a>
            <a
              className={buttonVariants({ size: "lg", variant: "outline" })}
              href={`${REPO}#readme`}
            >
              Read the docs
            </a>
          </div>
          <p className="text-muted-foreground text-sm">
            Then <code className="font-mono">pnpm install</code>, copy{" "}
            <code className="font-mono">apps/web/.env.example</code>, and run{" "}
            <code className="font-mono">pnpm dev:web</code>. Node 22, pnpm 11
            and Postgres.
          </p>
        </section>
        <ReceiptSection version={BUILD.version} />
      </main>
      <SiteFooter build={BUILD} />
    </LandingProvider>
  );
}
