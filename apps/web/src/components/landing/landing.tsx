import { CURRENCIES, catalog } from "@workspace/billing";
import type { Currency } from "@workspace/billing/money";

import { LandingProvider } from "@/components/landing/currency-context";
import { opticalEdge } from "@/components/landing/display";
import { CodeOutcome } from "@/components/landing/features/code-outcome";
import { Hero } from "@/components/landing/hero";
import { Pricing } from "@/components/landing/pricing";
import { ReceiptSection } from "@/components/landing/receipt-section";
import { type BuildInfo, SiteFooter } from "@/components/landing/site-footer";
import type { PlanInfo, PriceTable } from "@/components/landing/types";
import { WebhookSplit } from "@/components/landing/webhooks/split";
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

const WEBHOOKS_TITLE = "Only signed events change a plan.";
const FEATURES_TITLE = "The Paystack billing you’d otherwise write yourself.";

/**
 * The landing, in story order: the hook (hero), two proofs (webhooks, then
 * the features), the pricing page the starter ships with, and the close
 * (nothing to pay, one command). The footer holds every link.
 */
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
          className="landing-section grid scroll-mt-8 gap-10"
          id="webhooks"
        >
          <div className="landing-head">
            <h2
              className="display-l max-w-[18ch]"
              id="webhooks-title"
              style={opticalEdge(WEBHOOKS_TITLE)}
            >
              {WEBHOOKS_TITLE}
            </h2>
            <p className="text-pretty text-muted-foreground">
              Paystack signs every event it sends. The starter checks the
              signature, stores each event once and applies them in order. The
              browser can start a checkout, but it can’t change what anyone
              pays.
            </p>
          </div>
          <WebhookSplit prices={prices} />
        </section>

        <section
          aria-labelledby="features-title"
          className="landing-section grid scroll-mt-8 gap-10"
          id="features"
        >
          <div className="landing-head">
            <h2
              className="display-l max-w-[18ch]"
              id="features-title"
              style={opticalEdge(FEATURES_TITLE)}
            >
              {FEATURES_TITLE}
            </h2>
            <p className="text-pretty text-muted-foreground">
              Paystack leaves proration, plan swaps and event ordering to you.
              Here is the code that handles them, from the repo, next to what it
              does.
            </p>
          </div>
          <CodeOutcome />
        </section>

        <Pricing plans={PLANS} prices={prices} />

        <ReceiptSection version={BUILD.version} />
      </main>
      <SiteFooter build={BUILD} />
    </LandingProvider>
  );
}
