import { Button } from "@workspace/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { ReceiptTextIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Monogram } from "@/components/shared/avatars";
import type { DashboardData, SubscriptionSummary } from "@/directions/types";
import {
  daysUntil,
  formatDate,
  INVOICE_META,
  roleLabel,
  STATUS_META,
} from "@/lib/format";
import { Meter, Money, PageHeader, Panel, Pill, Section } from "./ui";

const REASON: Record<string, string> = {
  active: "Paid features are on.",
  trialing: "Paid features are on for the trial.",
  non_renewing: "Paid features stay on until the period ends.",
  past_due_grace: "Paid features stay on during the grace period.",
  no_subscription: "You're on the free plan. Paid features are off.",
  period_ended: "The billing period ended. Paid features are off.",
  grace_ended: "The grace period ended. Paid features are off.",
  canceled: "The subscription was canceled. Paid features are off.",
};

function Kpi({
  label,
  children,
  foot,
}: {
  label: string;
  children: ReactNode;
  foot?: ReactNode;
}) {
  return (
    <div className="grid content-start gap-2 bg-card p-5">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="grid gap-2">
        <div className="flex min-h-8 items-center gap-2 font-semibold text-2xl tracking-tight">
          {children}
        </div>
        {foot ? (
          <div className="text-muted-foreground text-sm">{foot}</div>
        ) : null}
      </dd>
    </div>
  );
}

function nextCharge(sub: SubscriptionSummary | null) {
  if (!sub) {
    return { amount: null, foot: "Free plan, nothing to charge" };
  }
  if (sub.status === "past_due") {
    return {
      amount: sub.priceLabel,
      foot: `Payment failed. Access until ${formatDate(sub.graceUntil)}`,
    };
  }
  if (sub.cancelAtPeriodEnd || sub.status === "non_renewing") {
    return {
      amount: null,
      foot: `Access ends ${formatDate(sub.currentPeriodEnd)}`,
    };
  }
  if (sub.status === "trialing") {
    const days = daysUntil(sub.trialEndsAt);
    return {
      amount: sub.priceLabel,
      foot: `When the trial ends on ${formatDate(sub.trialEndsAt)}${days !== null && days >= 0 ? `, in ${days} days` : ""}`,
    };
  }
  return {
    amount: sub.priceLabel,
    foot: `On ${formatDate(sub.currentPeriodEnd)}`,
  };
}

export function LedgerDashboard({ data }: { data: DashboardData }) {
  const sub = data.subscription;
  const charge = nextCharge(sub);
  const status = sub ? STATUS_META[sub.status] : STATUS_META.free;
  const firstName = data.user.name.split(" ")[0];

  return (
    <div className="grid gap-10">
      <PageHeader
        actions={
          data.can.invite ? (
            <Button asChild size="sm" variant="outline">
              <Link href={data.hrefs.members}>
                <UserPlusIcon />
                Invite people
              </Link>
            </Button>
          ) : null
        }
        description={
          <span data-testid="entitlement">
            {REASON[data.entitlement.reason] ?? data.entitlement.reason}
          </span>
        }
        title={`Good to see you, ${firstName}`}
      />

      <dl className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          foot={
            sub
              ? `${sub.interval === "annually" ? "Billed yearly" : "Billed monthly"} in ${sub.currency}`
              : `Up to ${data.members.limit} members`
          }
          label="Plan"
        >
          {data.entitlement.planName}
          <Pill tone={status.tone}>{status.label}</Pill>
        </Kpi>
        <Kpi
          foot={
            data.can.viewBilling
              ? charge.foot
              : "Only owners and billing can see this"
          }
          label="Next charge"
        >
          {data.can.viewBilling && charge.amount ? (
            <Money label={charge.amount} />
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </Kpi>
        <Kpi
          foot={
            <Meter
              label="Seats used"
              max={data.members.limit}
              value={data.members.total}
            />
          }
          label="Seats"
        >
          <span className="tabular-nums">
            {data.members.total}
            <span className="font-normal text-muted-foreground">
              {" "}
              of {data.members.limit}
            </span>
          </span>
        </Kpi>
        <Kpi
          foot={
            <Link
              className="text-(--ledger-accent) underline-offset-4 hover:underline"
              href={data.hrefs.members}
            >
              Manage members
            </Link>
          }
          label="Pending invites"
        >
          <span className="tabular-nums">{data.pendingInvitations}</span>
        </Kpi>
      </dl>

      <div className="grid gap-10 lg:grid-cols-5 lg:gap-8">
        {data.can.viewBilling ? (
          <Section
            action={
              data.hrefs.billing ? (
                <Button asChild className="-mr-3" size="sm" variant="ghost">
                  <Link href={data.hrefs.billing}>View billing</Link>
                </Button>
              ) : null
            }
            className="lg:col-span-3"
            title="Recent invoices"
          >
            <Panel>
              {data.recentInvoices.length === 0 ? (
                <div className="grid justify-items-center gap-2 px-6 py-12 text-center">
                  <ReceiptTextIcon
                    aria-hidden
                    className="size-5 text-muted-foreground"
                  />
                  <p className="font-medium text-sm">No invoices yet</p>
                  <p className="text-muted-foreground text-sm">
                    They appear here after the first charge.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-10 pl-5 text-muted-foreground">
                        Date
                      </TableHead>
                      <TableHead className="hidden h-10 text-muted-foreground sm:table-cell">
                        Description
                      </TableHead>
                      <TableHead className="h-10 text-right text-muted-foreground">
                        Amount
                      </TableHead>
                      <TableHead className="h-10 w-28 pr-5 text-muted-foreground">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentInvoices.map((inv) => {
                      const meta = INVOICE_META[inv.status] ?? {
                        label: inv.status,
                        tone: "neutral" as const,
                      };
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="h-12 whitespace-nowrap pl-5 tabular-nums">
                            {formatDate(inv.date)}
                          </TableCell>
                          <TableCell className="hidden max-w-0 truncate text-muted-foreground sm:table-cell">
                            {inv.description}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <Money label={inv.amountLabel} />
                          </TableCell>
                          <TableCell className="pr-5">
                            <Pill tone={meta.tone}>{meta.label}</Pill>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Panel>
          </Section>
        ) : null}

        <Section
          action={
            <Button asChild className="-mr-3" size="sm" variant="ghost">
              <Link href={data.hrefs.members}>All members</Link>
            </Button>
          }
          className={data.can.viewBilling ? "lg:col-span-2" : "lg:col-span-5"}
          title="Team"
        >
          <Panel>
            <ul className="divide-y">
              {data.members.recent.map((m) => (
                <li className="flex h-14 items-center gap-3 px-5" key={m.id}>
                  <Monogram
                    className="size-8"
                    name={m.name}
                    seed={m.email}
                    shape="circle"
                    tone="soft"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">
                      {m.name}
                      {m.isMe ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          (you)
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-muted-foreground text-xs">
                      {m.email}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-sm">
                    {roleLabel(m.role)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </Section>
      </div>
    </div>
  );
}
