import { CURRENCIES, catalog } from "@workspace/billing";
import type { Currency } from "@workspace/billing/money";
import { buttonVariants } from "@workspace/ui/components/button";
import { GitForkIcon } from "lucide-react";

import { LandingProvider } from "@/components/landing/currency-context";
import { Hero } from "@/components/landing/hero";
import { Pricing } from "@/components/landing/pricing";
import { ReceiptSection } from "@/components/landing/receipt-section";
import { type BuildInfo, SiteFooter } from "@/components/landing/site-footer";
import { StartCommand } from "@/components/landing/start-command";
import type { PlanInfo, PriceTable } from "@/components/landing/types";
import { FeaturesCode } from "@/components/landing/features/code-outcome";
import { WebhookSplit } from "@/components/landing/webhooks/split";
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

export function Landing({ initialCurrency }: { initialCurrency: Currency }) {
  const prices = priceTable();
  return (
    <LandingProvider initialCurrency={initialCurrency}>
      {/* Padding, not the hero's margin: a top margin would collapse
          through <body> and shift the page once hydration settles. */}
      <div className="pt-(--edge)">
        <Hero prices={prices} />
      </div>
      <main
        className="grid grid-cols-[minmax(0,1fr)] gap-24 pt-24 sm:gap-32 sm:pt-32"
        id="content"
      >
        <section
          aria-labelledby="webhooks-title"
          className="landing-section grid scroll-mt-8 gap-8 sm:gap-10"
          id="webhooks"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end lg:gap-16">
            <h2
              className="max-w-[18ch] text-balance font-semibold text-[clamp(36px,4.6vw,64px)] leading-[0.98] tracking-[-0.045em]"
              id="webhooks-title"
            >
              Only signed events change a plan.
            </h2>
            <p className="text-pretty text-muted-foreground">
              Paystack signs every event it sends. The starter checks the
              signature, stores each event once and applies them in order. The
              browser can start a checkout, but it can’t change what anyone
              pays.
            </p>
          </div>
          <WebhookSplit />
        </section>

        <Pricing plans={PLANS} prices={prices} />

        <section
          aria-labelledby="features-title"
          className="landing-section grid gap-10"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end">
            <h2
              className="max-w-[16ch] text-balance font-semibold text-[clamp(36px,5vw,72px)] leading-[0.96] tracking-[-0.045em]"
              id="features-title"
            >
              The billing you’d otherwise write yourself.
            </h2>
            <p className="text-pretty text-muted-foreground">
              Real code from the repo, next to what it does.
            </p>
          </div>
          <FeaturesCode />
        </section>

        <section
          aria-labelledby="start-title"
          className="landing-section grid scroll-mt-8 gap-6 sm:gap-8"
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
