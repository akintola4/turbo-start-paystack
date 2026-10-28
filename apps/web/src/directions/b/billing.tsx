import { cn } from "@workspace/tailwind-config/utils";
import {
  CheckCircle2Icon,
  ClockIcon,
  CreditCardIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BillingAction } from "@/components/shared/billing-action";
import type { BillingData } from "@/directions/types";
import {
  daysUntil,
  formatDate,
  INVOICE_META,
  intervalLabel,
  STATUS_META,
} from "@/lib/format";
import { PlanPicker } from "./plan-picker";
import { Dot, money, PageHeader, Pill, SettingsSection } from "./primitives";

function Banner({
  tone,
  icon,
  title,
  children,
  action,
}: {
  tone: "warning" | "positive" | "info";
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border px-4 py-3 text-[13px]",
        tone === "warning" && "border-warning/40 bg-warning/8",
        tone === "positive" && "border-success/35 bg-success/7",
        tone === "info" && "border-[var(--info)]/35 bg-[var(--info)]/7"
      )}
      role={tone === "warning" ? "alert" : "status"}
    >
      <span
        className={cn(
          "mt-0.5 [&_svg]:size-4",
          tone === "warning" && "text-warning",
          tone === "positive" && "text-success",
          tone === "info" && "text-[var(--info)]"
        )}
      >
        {icon}
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="font-medium">{title}</p>
        {children ? <p className="text-muted-foreground">{children}</p> : null}
      </div>
      {action}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 px-4 py-2.5 text-[13px] sm:grid-cols-[160px_minmax(0,1fr)]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 tabular-nums">{children}</dd>
    </div>
  );
}

export function Billing({ data }: { data: BillingData }) {
  const sub = data.subscription;
  const status = STATUS_META[sub?.status ?? "free"];
  const graceDays =
    sub?.status === "past_due" ? daysUntil(sub.graceUntil) : null;
  const trialDays =
    sub?.status === "trialing" ? daysUntil(sub.trialEndsAt) : null;
  const card = sub?.card;
  const cardLabel = card
    ? `${(card.brand ?? "Card").replace(/^./, (c) => c.toUpperCase())} ending ${card.last4}`
    : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        description={`Plan, payment method and invoices for ${data.org.name}.`}
        title="Billing"
      />

      {sub?.status === "past_due" || data.payment ? (
        <div className="grid gap-2">
          {sub?.status === "past_due" ? (
            <Banner
              action={
                data.canManage ? (
                  <BillingAction
                    action="manage-card"
                    className="h-8"
                    orgId={data.org.id}
                    size="sm"
                  >
                    Update card
                  </BillingAction>
                ) : null
              }
              icon={<TriangleAlertIcon />}
              title="The last renewal payment failed"
              tone="warning"
            >
              Update the card before {formatDate(sub.graceUntil)}
              {graceDays !== null && graceDays >= 0
                ? ` (${graceDays} days)`
                : ""}{" "}
              to keep paid features.
            </Banner>
          ) : null}
          {data.payment === "succeeded" ? (
            <Banner
              icon={<CheckCircle2Icon />}
              title="Payment confirmed"
              tone="positive"
            >
              Paystack confirmed the transaction and your plan is up to date.
            </Banner>
          ) : data.payment === "created" ? (
            <Banner
              icon={<ClockIcon />}
              title="Waiting for Paystack"
              tone="info"
            >
              We haven't received confirmation yet. Refresh in a moment.
            </Banner>
          ) : null}
        </div>
      ) : null}

      <div>
        <SettingsSection
          description="What this organization pays for and when."
          id="plan"
          title="Current plan"
        >
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
              <span className="font-display font-semibold text-[17px] tracking-[-0.015em]">
                {data.entitlement.planName}
              </span>
              <span data-testid="subscription-status">
                <Pill tone={status.tone}>{status.label}</Pill>
              </span>
              <span className="ml-auto text-[14px] tabular-nums">
                {sub ? (
                  <>
                    {money(sub.priceLabel)}
                    <span className="text-muted-foreground">
                      {" "}
                      / {intervalLabel(sub.interval)}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Free</span>
                )}
              </span>
            </div>
            {sub ? (
              <dl className="divide-y">
                {sub.status === "trialing" ? (
                  <Row label="Trial ends">
                    {formatDate(sub.trialEndsAt)}
                    {trialDays !== null ? (
                      <span className="text-muted-foreground">
                        {" "}
                        in {trialDays} days, then the card is charged
                      </span>
                    ) : null}
                  </Row>
                ) : null}
                {sub.status === "past_due" ? (
                  <Row label="Grace until">{formatDate(sub.graceUntil)}</Row>
                ) : sub.status === "trialing" ? null : (
                  <Row label={sub.cancelAtPeriodEnd ? "Access ends" : "Renews"}>
                    {formatDate(sub.currentPeriodEnd)}
                  </Row>
                )}
                <Row label="Billed">
                  {sub.interval === "annually" ? "Annually" : "Monthly"} in{" "}
                  {sub.currency}
                </Row>
                {sub.scheduled ? (
                  <Row label="Scheduled">
                    Switches to {sub.scheduled.planName} (
                    {sub.scheduled.interval}) on{" "}
                    {formatDate(sub.currentPeriodEnd)}
                  </Row>
                ) : null}
              </dl>
            ) : (
              <p className="px-4 py-3 text-[13px] text-muted-foreground">
                No paid subscription. Pick a plan below; paid plans start with a
                14-day trial.
              </p>
            )}
          </div>
        </SettingsSection>

        <SettingsSection
          description={`Prices in ${data.currency}. Upgrades are prorated; downgrades wait for the period to end.`}
          id="change"
          title="Change plan"
        >
          <div className="grid gap-3">
            <nav
              aria-label="Billing interval"
              className="inline-flex h-8 w-fit items-center rounded-md border bg-muted/40 p-0.5 text-[12.5px]"
            >
              {(["monthly", "annually"] as const).map((interval) => (
                <Link
                  aria-current={data.interval === interval ? "page" : undefined}
                  className={cn(
                    "flex h-full items-center rounded-[5px] px-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                    data.interval === interval
                      ? "bg-background font-medium text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  href={data.hrefs[interval]}
                  key={interval}
                  replace
                  scroll={false}
                >
                  {interval === "monthly" ? "Monthly" : "Annually"}
                </Link>
              ))}
            </nav>
            <PlanPicker data={data} key={data.interval} />
          </div>
        </SettingsSection>

        {sub ? (
          <SettingsSection
            description="Renewals and prorated charges use this card."
            id="payment"
            title="Payment method"
          >
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3">
              <span className="flex h-7 w-10 items-center justify-center rounded border bg-muted/50">
                <CreditCardIcon
                  aria-hidden
                  className="size-4 text-muted-foreground"
                />
              </span>
              <div className="grid min-w-0 flex-1">
                <span className="text-[13.5px]">
                  {cardLabel ?? "No card on file"}
                </span>
                {card?.exp ? (
                  <span className="font-mono text-[11.5px] text-muted-foreground">
                    Expires {card.exp}
                  </span>
                ) : null}
              </div>
              {data.canManage ? (
                <BillingAction
                  action="manage-card"
                  className="h-8"
                  orgId={data.org.id}
                  size="sm"
                  variant="outline"
                >
                  Update card
                </BillingAction>
              ) : null}
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Card details are held by Paystack, not by this app.
            </p>
          </SettingsSection>
        ) : null}

        {sub && data.canManage ? (
          sub.status === "non_renewing" || sub.cancelAtPeriodEnd ? (
            <SettingsSection
              description="The subscription is set to end. Resume it to keep renewing."
              id="resume"
              title="Resume subscription"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-[13px]">
                <span className="text-muted-foreground">
                  Access ends on{" "}
                  <span className="text-foreground">
                    {formatDate(sub.currentPeriodEnd)}
                  </span>
                  .
                </span>
                <BillingAction
                  action="resume"
                  className="h-8"
                  orgId={data.org.id}
                  size="sm"
                >
                  Resume subscription
                </BillingAction>
              </div>
            </SettingsSection>
          ) : (
            <SettingsSection
              description="Stop renewing. Paid features stay on until the period ends."
              id="cancel"
              title="Cancel subscription"
              tone="danger"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 px-4 py-3 text-[13px]">
                <span className="text-muted-foreground">
                  {sub.status === "trialing"
                    ? "Cancel before the trial ends and the card is never charged."
                    : sub.status === "past_due"
                      ? `Stops renewal attempts. Paid features end with the grace period on ${formatDate(sub.graceUntil)}.`
                      : `You keep ${sub.planName} until ${formatDate(sub.currentPeriodEnd)}.`}
                </span>
                <BillingAction
                  action="cancel"
                  className="h-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  confirm={{
                    title: "Cancel at the end of this period?",
                    description: `${data.org.name} keeps ${sub.planName} until ${formatDate(sub.currentPeriodEnd)}. After that it moves to Free and members above the Free limit lose access. You can resume any time before then.`,
                    confirmLabel: "Cancel subscription",
                    destructive: true,
                  }}
                  orgId={data.org.id}
                  size="sm"
                  variant="outline"
                >
                  Cancel subscription
                </BillingAction>
              </div>
            </SettingsSection>
          )
        ) : null}

        <SettingsSection
          description="Paystack sends a receipt by email for each charge."
          id="invoices"
          title="Invoices"
        >
          {data.invoices.length ? (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b text-left text-[12px] text-muted-foreground">
                    <th className="h-9 w-28 px-4 font-medium">Date</th>
                    <th className="hidden h-9 px-4 font-medium sm:table-cell">
                      Description
                    </th>
                    <th className="h-9 px-4 font-medium sm:w-28">Status</th>
                    <th className="h-9 w-32 px-4 text-right font-medium">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.invoices.map((inv) => {
                    const meta = INVOICE_META[inv.status] ?? {
                      label: inv.status,
                      tone: "neutral" as const,
                    };
                    return (
                      <tr key={inv.id}>
                        <td className="h-10 whitespace-nowrap px-4 font-mono text-[12px] text-muted-foreground tabular-nums">
                          {formatDate(inv.date)}
                        </td>
                        <td className="hidden h-10 px-4 sm:table-cell">
                          {inv.description}
                        </td>
                        <td className="h-10 px-4">
                          <span className="flex items-center gap-1.5">
                            <Dot tone={meta.tone} />
                            {meta.label}
                          </span>
                        </td>
                        <td
                          className={cn(
                            "h-10 whitespace-nowrap px-4 text-right tabular-nums",
                            inv.status === "void" &&
                              "text-muted-foreground line-through decoration-muted-foreground/50"
                          )}
                        >
                          {money(inv.amountLabel)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed px-4 py-5 text-[13px] text-muted-foreground">
              No invoices yet. They appear here after the first charge.
            </p>
          )}
        </SettingsSection>
      </div>
    </div>
  );
}
