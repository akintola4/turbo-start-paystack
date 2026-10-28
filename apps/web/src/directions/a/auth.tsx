import { formatMoney, getPlanPrice } from "@workspace/billing";
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AuthForm, AuthSwitch } from "@/components/shared/auth-form";
import { Money, Wordmark } from "./ui";

/** Two-column frame shared by sign-in, sign-up and accept-invite. */
export function AuthFrame({
  children,
  aside,
}: {
  children: ReactNode;
  aside: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-card lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col">
        <header className="mx-auto flex h-16 w-full max-w-[22.5rem] items-center px-0 max-sm:px-6 max-sm:max-w-none">
          <Link
            aria-label="Turbo Start Paystack home"
            className="flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/"
          >
            <Wordmark />
          </Link>
        </header>
        <main className="flex flex-1 items-center px-6 pt-8 pb-24 sm:px-0">
          <div className="mx-auto w-full max-w-[22.5rem]">{children}</div>
        </main>
      </div>
      <aside className="hidden border-l bg-background lg:flex lg:items-center lg:px-16 xl:px-24">
        <div className="w-full max-w-[24rem]">{aside}</div>
      </aside>
    </div>
  );
}

function NextSteps({ mode }: { mode: "sign-in" | "sign-up" }) {
  const starter = getPlanPrice("starter-monthly-ngn");
  const steps =
    mode === "sign-up"
      ? [
          "Verify your email address",
          "Create an organization and invite your team",
          "Pick a plan. Trials last 14 days, card on file",
        ]
      : [
          "Pick up where you left off in any organization",
          "Plans, invoices and roles are where you left them",
          "Billing state comes from Paystack, never the browser",
        ];
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h2 className="font-display font-semibold text-xl tracking-tight">
          {mode === "sign-up" ? "What happens next" : "Welcome back"}
        </h2>
        <ol className="grid gap-3 pt-2">
          {steps.map((s, i) => (
            <li className="flex gap-3 text-sm" key={s}>
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full border bg-card font-medium text-[11px] text-muted-foreground tabular-nums">
                {mode === "sign-up" ? (
                  i + 1
                ) : (
                  <CheckIcon aria-hidden className="size-3" />
                )}
              </span>
              <span className="pt-px text-muted-foreground">{s}</span>
            </li>
          ))}
        </ol>
      </div>
      {starter ? (
        <div className="rounded-lg border bg-card text-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-medium">Starter trial</span>
            <span className="text-muted-foreground">14 days</span>
          </div>
          <dl className="grid gap-2 px-4 py-3">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Today</dt>
              <dd className="tabular-nums">Card check, refunded</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">After the trial</dt>
              <dd>
                <Money
                  label={formatMoney(starter.amountSubunit, starter.currency)}
                />
                <span className="text-muted-foreground"> a month</span>
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}

export function LedgerAuth({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <AuthFrame aside={<NextSteps mode={mode} />}>
      <div className="grid gap-8">
        <div className="grid gap-1.5">
          <h1 className="font-display font-semibold text-2xl tracking-tight">
            {mode === "sign-in" ? "Sign in" : "Create your account"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {mode === "sign-in"
              ? "Use the email and password you signed up with."
              : "We'll send an email to verify your address."}
          </p>
        </div>
        <AuthForm mode={mode} />
        <AuthSwitch mode={mode} />
      </div>
    </AuthFrame>
  );
}
