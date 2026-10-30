import { CURRENCIES, catalog } from "@workspace/billing";
import type { Currency } from "@workspace/billing/money";
import type { ReactNode } from "react";

import {
  type Interval,
  LandingProvider,
} from "@/components/landing/currency-context";
import { opticalEdge } from "@/components/landing/display";
import { Faq } from "@/components/landing/faq";
import { FeatureIde } from "@/components/landing/features/ide";
import { Hero } from "@/components/landing/hero";
import { Pricing } from "@/components/landing/pricing";
import { ReceiptSection } from "@/components/landing/receipt-section";
import { type BuildInfo, SiteFooter } from "@/components/landing/site-footer";
import type { PlanInfo, PriceTable } from "@/components/landing/types";
// import { WebhookReplay } from "@/components/landing/webhooks/replay";
import { formatUpdated } from "@/lib/landing";

type PaidPlan = "starter" | "pro";
type CatalogInterval = "monthly" | "annually";

/** A catalog price in subunits. A missing one is a catalog bug: the build
 *  fails here rather than showing a paid plan as free. */
function amount(key: PaidPlan, code: Currency, interval: CatalogInterval) {
  const price = catalog
    .find((p) => p.key === key)
    ?.prices.find((p) => p.currency === code && p.interval === interval);
  if (!price) {
    throw new Error(`catalog has no ${interval} ${key} price in ${code}`);
  }
  return price.amountSubunit;
}

function priceTable(): PriceTable {
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

// const WEBHOOKS_TITLE = "Only signed events change a plan.";
const FEATURES_TITLE = "The Paystack billing you’d otherwise write yourself.";

/**
 * A proof section's head: the title, then its lead directly under it, one
 * column. Titles get ~17ch, so they break into two balanced lines.
 */
function ProofHead({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-4">
      <h2
        className="max-w-[17ch] text-balance font-medium text-[32px] leading-[1.1] tracking-[-0.035em] sm:text-[40px]"
        id={id}
        style={opticalEdge(title)}
      >
        {title}
      </h2>
      <p className="max-w-[44ch] text-pretty text-[18px] text-muted-foreground leading-[1.5]">
        {children}
      </p>
    </div>
  );
}

/**
 * The landing, in story order: the hook (hero), two proofs (webhooks, then
 * the features), the pricing page the starter ships with, and the close
 * (nothing to pay, one command). The footer holds every link.
 */
export function Landing({
  initialCurrency,
  initialInterval,
  signedIn = false,
}: {
  initialCurrency: Currency;
  initialInterval?: Interval;
  signedIn?: boolean;
}) {
  const prices = priceTable();
  return (
    <LandingProvider
      initialCurrency={initialCurrency}
      initialInterval={initialInterval}
    >
      {/* Padding, not the hero's margin: a top margin would collapse
          through <body> and shift the page once hydration settles. */}
      <div className="pt-(--edge)">
        <Hero prices={prices} signedIn={signedIn} />
      </div>
      <main
        className="grid grid-cols-[minmax(0,1fr)] gap-24 pt-24 sm:gap-32 sm:pt-32"
        id="content"
      >
        {/*
          Hidden for now, kept to bring back: the webhooks proof ("Only signed
          events change a plan."). To restore it, uncomment this section, the
          WEBHOOKS_TITLE constant, the WebhookReplay import, and the "How
          billing works" links in hero.tsx and site-footer.tsx.

        <section
          aria-labelledby="webhooks-title"
          className="landing-section grid scroll-mt-8 gap-10 sm:gap-12"
          id="webhooks"
        >
          <ProofHead id="webhooks-title" title={WEBHOOKS_TITLE}>
            Paystack signs every event it sends. The starter checks the
            signature, stores each event once and applies them in order. The
            browser can start a checkout, but it can’t change what anyone pays.
          </ProofHead>
          <WebhookReplay prices={prices} />
        </section>
        */}

        <section
          aria-labelledby="features-title"
          className="landing-section grid scroll-mt-8 gap-10 sm:gap-12"
          id="features"
        >
          <ProofHead id="features-title" title={FEATURES_TITLE}>
            Paystack leaves proration, plan swaps and event ordering to you.
            Here is the code that handles them, from the repo, next to what it
            does.
          </ProofHead>
          <FeatureIde />
        </section>

        <Pricing plans={PLANS} prices={prices} />

        <Faq />

        <ReceiptSection version={BUILD.version} />
      </main>
      <SiteFooter build={BUILD} />
    </LandingProvider>
  );
}
