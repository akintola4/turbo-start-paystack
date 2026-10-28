import { buttonVariants } from "@workspace/ui/components/button";
import { Progress } from "@workspace/ui/components/progress";
import { cn } from "@workspace/tailwind-config/utils";
import {
  CalendarIcon,
  CreditCardIcon,
  TriangleAlertIcon,
  UserPlusIcon,
} from "lucide-react";
import Link from "next/link";

import { AnimatedNumber } from "@/components/animated-number";
import { Monogram } from "@/components/avatars";
import { BillingAction } from "@/components/billing/billing-action";
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
import type { DashboardData, Role } from "@/lib/view-models";

const RANK: Record<string, number> = {
  owner: 4,
  admin: 3,
  billing: 2,
  member: 2,
  viewer: 1,
};
const INVITABLE: Role[] = ["admin", "billing", "member", "viewer"];

const linkClass =
  "rounded-chip font-semibold text-link text-sm underline-offset-4 hover:underline";

function chargeLine(data: DashboardData) {
  const sub = data.subscription;
  if (!sub) {
    return null;
  }
  if (sub.status === "past_due") {
    return `Payment failed. Update the card before ${formatDate(sub.graceUntil, "short")}.`;
  }
  if (sub.cancelAtPeriodEnd || sub.status === "non_renewing") {
    return `Access ends ${formatDate(sub.currentPeriodEnd, "short")}.`;
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
  return (
    <Panel className="grid content-between gap-8 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-xl">
            {sub ? `${sub.planName} plan` : `${data.entitlement.planName} plan`}
          </h2>
          <StatusBadge status={sub?.status ?? "free"} />
        </div>
        {data.hrefs.billing ? (
          <Link
            className={buttonVariants({ variant: "default", size: "sm" })}
            href={data.hrefs.billing}
          >
            {sub ? "Manage billing" : "See plans"}
          </Link>
        ) : null}
      </div>
      {sub ? (
        <div className="grid gap-3">
          <Money
            label={sub.priceLabel}
            per={intervalLabel(sub.interval, "long")}
            size="xl"
          />
          <p className="flex items-center gap-2 text-panel-muted">
            <CalendarIcon aria-hidden className="size-4 shrink-0" />
            <span>{chargeLine(data)}</span>
          </p>
        </div>
      ) : (
        <p className="max-w-[44ch] text-panel-muted">
          {data.can.viewBilling
            ? "Up to 3 members. Paid plans add seats and support, and start with a 14-day trial."
            : "Ask an owner or billing manager about upgrading."}
        </p>
      )}
    </Panel>
  );
}

function SeatsTile({ data }: { data: DashboardData }) {
  const used = data.members.total;
  const pct = Math.min(100, Math.round((used / data.members.limit) * 100));
  return (
    <Tile className="grid content-between gap-6">
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
            value={used}
          />
          <span className="text-lg text-muted-foreground">
            {" "}
            of {data.members.limit}
          </span>
        </p>
        <Progress aria-label="Seats used" value={pct} />
        <p className="text-muted-foreground text-sm">
          {data.pendingInvitations ? (
            <>
              <AnimatedNumber value={data.pendingInvitations} /> invitation
              {data.pendingInvitations === 1 ? "" : "s"} waiting
            </>
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
        data.can.viewBilling ? "md:col-span-1" : "md:col-span-3"
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
            <Monogram className="size-8" name={m.name} shape="circle" />
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
    <Tile className="grid content-start gap-4 md:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Recent payments</h2>
        {data.hrefs.billing ? (
          <Link className={linkClass} href={`${data.hrefs.billing}#invoices`}>
            All invoices
          </Link>
        ) : null}
      </div>
      {data.recentInvoices.length ? (
        <ul>
          {data.recentInvoices.map((inv) => (
            <li
              className="grid min-h-12 grid-cols-[1fr_auto] items-center gap-x-4 border-border border-t py-2 first:border-t-0 sm:grid-cols-[6.5rem_1fr_8rem_6rem]"
              key={inv.id}
            >
              <span className="text-muted-foreground text-sm tabular-nums">
                {formatDate(inv.date, "short")}
              </span>
              <span className="hidden truncate text-sm sm:block">
                {inv.description}
              </span>
              <span className="text-right">
                <Amount label={inv.amountLabel} />
              </span>
              <span className="hidden justify-self-end sm:inline-flex">
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
  const rank = RANK[data.role] ?? 0;
  const inviteRoles = INVITABLE.filter((r) => (RANK[r] ?? 0) <= rank);
  const pastDue = sub?.status === "past_due";
  return (
    <div className="grid animate-content gap-8">
      <PageHeader
        actions={
          data.can.invite ? (
            <InviteDialog
              organizationId={data.org.id}
              roles={inviteRoles}
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
          ) : null
        }
        description={
          sub ? (
            <span className="inline-flex flex-wrap items-center gap-x-1.5">
              {chargeLine(data)}
            </span>
          ) : (
            `${data.entitlement.planName} plan`
          )
        }
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
      <div className="grid gap-4 md:grid-cols-3">
        <PlanPanel data={data} />
        <SeatsTile data={data} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <TeamTile data={data} />
        {data.can.viewBilling ? <PaymentsTile data={data} /> : null}
      </div>
    </div>
  );
}
