import { cn } from "@workspace/tailwind-config/utils";
import { buttonVariants } from "@workspace/ui/components/button";
import { Progress } from "@workspace/ui/components/progress";
import {
  CalendarIcon,
  CreditCardIcon,
  TriangleAlertIcon,
  UserPlusIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AnimatedNumber } from "@/components/animated-number";
import { BillingAction } from "@/components/billing/billing-action";
import { MarkAvatar } from "@/components/mark-avatar";
import { InviteDialog } from "@/components/members/member-actions";
import {
  Amount,
  InvoiceBadge,
  Money,
  PageHeader,
  Panel,
  StatusBadge,
  Tile,
} from "@/components/primitives";
import { daysUntil, formatDate, intervalLabel, roleLabel } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { DashboardData } from "@/lib/view-models";

const linkClass =
  "relative rounded-chip font-semibold text-link text-sm underline-offset-4 before:absolute before:-inset-x-1 before:-inset-y-3 hover:underline";

/**
 * The panel's one line under the amount. Past due and ending say the
 * fact only: the banner and the badge already carry the alarm and the date.
 */
function chargeLine(sub: NonNullable<DashboardData["subscription"]>) {
  if (sub.status === "past_due") {
    return `Renewal was due ${formatDate(sub.currentPeriodEnd, "short")}.`;
  }
  if (sub.cancelAtPeriodEnd || sub.status === "non_renewing") {
    return "No further charges.";
  }
  const when =
    sub.status === "trialing" ? sub.trialEndsAt : sub.currentPeriodEnd;
  const days = daysUntil(when);
  const lead = sub.status === "trialing" ? "First charge" : "Next charge";
  return (
    <>
      {lead} <Amount label={sub.priceLabel} /> on {formatDate(when, "short")}
      {days !== null && days >= 0 ? ` (in ${days} days)` : ""}
    </>
  );
}

function PlanPanel({ data }: { data: DashboardData }) {
  const sub = data.subscription;
  const { plan } = data;
  const pastDue = plan.status === "past_due";
  let body: ReactNode;
  if (sub) {
    body = (
      <div className="grid gap-3">
        <Money
          label={sub.priceLabel}
          per={intervalLabel(sub.interval, "long")}
          size="xl"
        />
        <p className="flex items-center gap-2 text-panel-muted">
          <CalendarIcon aria-hidden className="size-4 shrink-0" />
          <span>{chargeLine(sub)}</span>
        </p>
      </div>
    );
  } else if (plan.status) {
    // A paid plan seen by a role without billing access: no amounts.
    body = (
      <p className="max-w-[44ch] text-panel-muted">
        Billing is handled by owners and billing managers.
      </p>
    );
  } else {
    body = (
      <div className="grid gap-3">
        {data.can.viewBilling ? (
          <Money label={formatMoney(0, data.currency)} per="month" size="xl" />
        ) : null}
        <p className="max-w-[44ch] text-panel-muted">
          {data.can.viewBilling
            ? `Up to ${data.members.limit} members. Paid plans add seats and support, and start with a 14-day trial.`
            : "Ask an owner or billing manager about upgrading."}
        </p>
      </div>
    );
  }
  return (
    <Panel className="grid content-between gap-8 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-xl">
            {plan.status ? `${plan.name} plan` : "Free"}
          </h2>
          {plan.status ? (
            <StatusBadge endsAt={plan.endsAt} status={plan.status} />
          ) : null}
        </div>
        {/* Past due has one action, in the banner above. */}
        {data.hrefs.billing && !pastDue ? (
          <Link
            className={buttonVariants({ variant: "default", size: "sm" })}
            href={data.hrefs.billing}
          >
            {sub ? "Manage billing" : "See plans"}
          </Link>
        ) : null}
      </div>
      {body}
    </Panel>
  );
}

/** At the seat limit, the way forward: more seats, or who to ask. */
function AddSeats({ data }: { data: DashboardData }) {
  if (data.can.manageBilling && data.hrefs.billing) {
    return (
      <Link
        className={buttonVariants({ variant: "outline" })}
        href={`${data.hrefs.billing}#plans`}
      >
        <UserPlusIcon aria-hidden />
        Add seats
      </Link>
    );
  }
  return (
    <p className="text-muted-foreground text-sm">
      All {data.seats.max} seats are in use. Ask an owner to add more.
    </p>
  );
}

function SeatsTile({ data }: { data: DashboardData }) {
  const { seats } = data;
  return (
    <Tile className="grid content-start gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Seats</h2>
        <Link className={linkClass} href={data.hrefs.members}>
          Members
        </Link>
      </div>
      <div className="grid gap-3">
        <p className="tabular-nums leading-none">
          <AnimatedNumber
            className="font-semibold text-[40px] tracking-[-0.02em]"
            value={seats.used}
          />
          <span className="text-lg text-muted-foreground"> of {seats.max}</span>
        </p>
        <Progress aria-label="Seats used" value={seats.pct} />
        <p className="text-muted-foreground text-sm">
          {data.pendingInvitations ? (
            <>
              Includes <AnimatedNumber value={data.pendingInvitations} />{" "}
              pending invitation
              {data.pendingInvitations === 1 ? "" : "s"}
            </>
          ) : seats.full ? (
            "Every seat is taken."
          ) : (
            "No pending invitations"
          )}
        </p>
      </div>
    </Tile>
  );
}

function TeamTile({ data }: { data: DashboardData }) {
  return (
    <Tile
      className={cn(
        "grid content-start gap-5",
        data.can.viewBilling ? "lg:col-span-1" : "lg:col-span-3"
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Team</h2>
        <span className="text-muted-foreground text-sm tabular-nums">
          <AnimatedNumber value={data.members.total} />{" "}
          {data.members.total === 1 ? "person" : "people"}
        </span>
      </div>
      <ul className="grid gap-3">
        {data.members.recent.slice(0, 5).map((m) => (
          <li className="flex items-center gap-3 text-sm" key={m.id}>
            <MarkAvatar seed={m.email} />
            <span className="min-w-0 flex-1 truncate font-medium">
              {m.name}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {roleLabel(m.role)}
            </span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}

function PaymentsTile({ data }: { data: DashboardData }) {
  return (
    <Tile className="grid content-start gap-4 lg:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Recent payments</h2>
        {data.hrefs.billing ? (
          <Link className={linkClass} href={`${data.hrefs.billing}#invoices`}>
            All invoices
          </Link>
        ) : null}
      </div>
      {data.recentInvoices.length ? (
        <ul className="-mx-2">
          {data.recentInvoices.map((inv) => (
            <li
              className="relative grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-border border-t px-2 py-2.5 transition-colors duration-(--dur-fast) first:border-t-0 hover:bg-surface-2 sm:grid-cols-[6.5rem_minmax(0,1fr)_8rem_6rem]"
              key={inv.id}
            >
              <span className="text-muted-foreground text-sm tabular-nums max-sm:col-start-1 max-sm:row-start-2">
                {formatDate(inv.date, "short")}
              </span>
              <Link
                className="truncate font-medium text-sm outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:outline-ring focus-visible:after:-outline-offset-2 max-sm:col-start-1 max-sm:row-start-1"
                href={inv.href}
              >
                {inv.description}
              </Link>
              <span
                className={cn(
                  "text-right max-sm:col-start-2 max-sm:row-start-1",
                  inv.status === "void" && "text-muted-foreground line-through"
                )}
              >
                <Amount label={inv.amountLabel} />
              </span>
              <span className="inline-flex justify-self-end max-sm:col-start-2 max-sm:row-start-2">
                <InvoiceBadge status={inv.status} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          No payments yet. They show up here after the first charge.
        </p>
      )}
    </Tile>
  );
}

export function Dashboard({ data }: { data: DashboardData }) {
  const sub = data.subscription;
  const pastDue = sub?.status === "past_due";
  let action: ReactNode = null;
  if (data.can.invite) {
    action = data.seats.full ? (
      <AddSeats data={data} />
    ) : (
      <InviteDialog
        organizationId={data.org.id}
        roles={data.inviteRoles}
        trigger={
          <button
            className={buttonVariants({ variant: "outline" })}
            type="button"
          >
            <UserPlusIcon aria-hidden />
            Invite teammate
          </button>
        }
      />
    );
  }
  return (
    <div className="grid animate-content gap-8">
      <PageHeader
        actions={action}
        description={`${roleLabel(data.role)} · ${data.members.total} ${
          data.members.total === 1 ? "member" : "members"
        }`}
        title={data.org.name}
      />
      {pastDue && sub ? (
        <div
          className="flex flex-col gap-4 rounded-tile bg-warning-bg p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          role="alert"
        >
          <div className="flex gap-3">
            <TriangleAlertIcon
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-warning"
            />
            <div className="grid gap-1">
              <p className="font-semibold">Payment failed</p>
              <p className="text-muted-foreground text-sm">
                Update the card before {formatDate(sub.graceUntil)} to keep paid
                features on.
              </p>
            </div>
          </div>
          {data.can.manageBilling ? (
            <BillingAction action="manage-card" orgId={data.org.id}>
              <CreditCardIcon aria-hidden />
              Update card
            </BillingAction>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <PlanPanel data={data} />
        <SeatsTile data={data} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <TeamTile data={data} />
        {data.can.viewBilling ? <PaymentsTile data={data} /> : null}
      </div>
    </div>
  );
}
