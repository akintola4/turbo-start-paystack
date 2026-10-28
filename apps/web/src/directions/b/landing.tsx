import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/tailwind-config/utils";
import Link from "next/link";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import type { Tone } from "@/lib/format";
import { Dot, Mark, Wordmark } from "./primitives";

const EVENTS: {
  time: string;
  event: string;
  state: string;
  tone: Tone;
  ref: string;
  amount: string;
}[] = [
  {
    time: "09:00:02",
    event: "charge.success",
    state: "verified",
    tone: "positive",
    ref: "tsp_969b2b02af46",
    amount: "₦50.00",
  },
  {
    time: "09:00:02",
    event: "subscription.create",
    state: "verified",
    tone: "positive",
    ref: "SUB_vd3kq8w1x0",
    amount: "",
  },
  {
    time: "09:00:03",
    event: "refund.processed",
    state: "card saved",
    tone: "neutral",
    ref: "tsp_969b2b02af46",
    amount: "₦50.00",
  },
  {
    time: "14 days",
    event: "invoice.update",
    state: "paid",
    tone: "positive",
    ref: "INV_2m9xk1p4",
    amount: "₦30,000.00",
  },
  {
    time: "30 days",
    event: "invoice.payment_failed",
    state: "past due",
    tone: "warning",
    ref: "INV_7q2nb6r0",
    amount: "₦30,000.00",
  },
  {
    time: "31 days",
    event: "charge.success",
    state: "recovered",
    tone: "positive",
    ref: "tsp_41c0e7d3aa19",
    amount: "₦30,000.00",
  },
  {
    time: "44 days",
    event: "subscription.not_renew",
    state: "cancels at end",
    tone: "neutral",
    ref: "SUB_vd3kq8w1x0",
    amount: "",
  },
];

const STEPS = [
  {
    title: "Checkout is created on the server",
    body: "The plan and amount come from your catalog. The browser only gets an access code.",
  },
  {
    title: "Your customer pays on Paystack",
    body: "Inline popup or hosted page, in naira, cedis, rand, shillings or dollars.",
  },
  {
    title: "A signed webhook is verified and stored",
    body: "HMAC checked, deduplicated by body hash, processed in order per customer.",
  },
  {
    title: "Access is computed on the server",
    body: "Pages and routes read the entitlement. Nothing the browser sends can change it.",
  },
];

const FACTS = [
  [
    "Organizations",
    "Members, invitations and five roles, from owner to viewer.",
  ],
  [
    "Plan changes",
    "Prorated upgrades now, downgrades at the end of the period.",
  ],
  [
    "Trials",
    "14 days with a card saved up front by a small refundable charge.",
  ],
  [
    "Dunning",
    "Seven days of grace, a banner and an email when a renewal fails.",
  ],
];

export function Landing() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-5 md:px-8">
        <Link
          aria-label="Turbo Start Paystack home"
          className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href="/"
        >
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="ml-auto flex items-center gap-1">
          <a
            className="hidden h-8 items-center rounded-md px-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            href="https://github.com/akintola4/turbo-start-paystack"
          >
            GitHub
          </a>
          <ThemeToggle className="size-8 text-muted-foreground" />
          <Button asChild className="h-8 text-[13px]" size="sm" variant="ghost">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild className="h-8 text-[13px]" size="sm">
            <Link href="/sign-up">Create account</Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1200px] items-start gap-12 px-5 pt-16 pb-20 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:gap-16 lg:pt-28">
          <div className="grid max-w-[520px] gap-6 lg:pt-6">
            <h1 className="text-balance font-display font-semibold text-[40px] leading-[1.05] tracking-[-0.035em] sm:text-[52px]">
              Subscriptions you can trust, because the browser never decides.
            </h1>
            <p className="text-pretty text-[16px] text-muted-foreground leading-7">
              An open-source Next.js starter for B2B SaaS that bills through
              Paystack. Organizations and roles, checkout, renewals and plan
              changes, all driven by verified webhooks.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild className="h-9 px-4">
                <Link href="/sign-up">Start a workspace</Link>
              </Button>
              <Button asChild className="h-9 px-4" variant="outline">
                <a href="https://github.com/akintola4/turbo-start-paystack">
                  Read the source
                </a>
              </Button>
            </div>
            <p className="font-mono text-[12px] text-muted-foreground">
              NGN GHS ZAR KES USD
            </p>
          </div>

          <figure
            aria-label="Example webhook event log for one subscription"
            className="min-w-0 overflow-hidden rounded-lg border bg-card shadow-[0_1px_0_0_var(--border),0_24px_48px_-24px_oklch(0_0_0/0.35)]"
          >
            <div className="flex h-10 items-center gap-2 border-b px-4 text-[12.5px]">
              <span className="font-medium">Webhook events</span>
              <span className="text-muted-foreground">kola-logistics</span>
              <span className="ml-auto flex items-center gap-1.5 text-muted-foreground">
                <Dot tone="positive" />
                Live
              </span>
            </div>
            <div className="hidden grid-cols-[64px_minmax(0,1fr)_104px_96px] gap-4 border-b px-4 py-2 text-[11.5px] text-muted-foreground sm:grid">
              <span>Time</span>
              <span>Event</span>
              <span>State</span>
              <span className="text-right">Amount</span>
            </div>
            <ol className="b-stagger divide-y">
              {EVENTS.map((e, i) => (
                <li
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-4 py-2.5 text-[12.5px] sm:grid-cols-[64px_minmax(0,1fr)_104px_96px]"
                  key={`${e.event}-${i}`}
                >
                  <span className="hidden font-mono text-[11.5px] text-muted-foreground tabular-nums sm:block">
                    {e.time}
                  </span>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate font-mono text-[12px] text-foreground">
                      {e.event}
                    </span>
                    <span className="truncate font-mono text-[11px] text-muted-foreground">
                      {e.ref}
                    </span>
                  </span>
                  <span className="order-last col-span-2 flex items-center gap-1.5 text-muted-foreground sm:order-none sm:col-span-1">
                    <Dot tone={e.tone} />
                    {e.state}
                  </span>
                  <span
                    className={cn(
                      "text-right tabular-nums",
                      !e.amount && "text-muted-foreground"
                    )}
                  >
                    {e.amount || "—"}
                  </span>
                </li>
              ))}
            </ol>
            <figcaption className="border-t bg-muted/40 px-4 py-2.5 text-[12px] text-muted-foreground">
              Every row was signed by Paystack and checked before it changed
              anything.
            </figcaption>
          </figure>
        </section>

        <section aria-labelledby="flow-title" className="border-t">
          <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-20 md:px-8">
            <div className="grid max-w-[520px] gap-2">
              <h2
                className="font-display font-semibold text-[24px] tracking-[-0.02em]"
                id="flow-title"
              >
                How a payment becomes access
              </h2>
              <p className="text-[14px] text-muted-foreground leading-6">
                Four steps, and the client is trusted in none of them.
              </p>
            </div>
            <ol className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <li
                  className="grid content-start gap-3 bg-background p-5"
                  key={step.title}
                >
                  <span className="flex size-6 items-center justify-center rounded-full border font-mono text-[11px] text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <h3 className="font-medium text-[14px] leading-5">
                    {step.title}
                  </h3>
                  <p className="text-[13px] text-muted-foreground leading-5">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
            <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
              {FACTS.map(([term, detail]) => (
                <div
                  className="grid content-start gap-1 border-t pt-4"
                  key={term}
                >
                  <dt className="font-medium text-[13px]">{term}</dt>
                  <dd className="text-[13px] text-muted-foreground leading-5">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-6 text-[12.5px] text-muted-foreground md:px-8">
          <span className="flex items-center gap-2 text-foreground">
            <Mark className="size-4" />
            Turbo Start Paystack
          </span>
          <span>MIT licensed</span>
          <a
            className="hover:text-foreground"
            href="https://github.com/akintola4/turbo-start-paystack"
          >
            github.com/akintola4/turbo-start-paystack
          </a>
        </div>
      </footer>
    </div>
  );
}
