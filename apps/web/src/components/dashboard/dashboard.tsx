import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Progress } from "@workspace/ui/components/progress";
import { cn } from "@workspace/tailwind-config/utils";
import { AlertTriangleIcon, CreditCardIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";

import { Monogram } from "@/components/avatars";
import { BillingAction } from "@/components/billing/billing-action";
import { InviteDialog } from "@/components/members/member-actions";
import type { DashboardData, Role } from "@/lib/view-models";
import {
  daysUntil,
  formatDate,
  INVOICE_META,
  intervalLabel,
  roleLabel,
  STATUS_META,
} from "@/lib/format";
import { Chip, Money, PageHeader, Tile } from "@/components/primitives";

const RANK: Record<string, number> = {
  owner: 4,
  admin: 3,
  billing: 2,
  member: 2,
  viewer: 1,
};
const INVITABLE: Role[] = ["admin", "billing", "member", "viewer"];

function PlanTile({ data }: { data: DashboardData }) {
  const sub = data.subscription;
  if (!sub) {
    return (
      <Tile className="grid content-between gap-8 border-0 bg-hero text-hero-foreground md:col-span-2">
        <div className="grid gap-1">
          <p className="font-medium text-hero-muted text-sm">Current plan</p>
          <p className="font-display font-semibold text-[32px] leading-none tracking-tight">
            {data.entitlement.planName}
          </p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="max-w-[40ch] text-hero-muted text-sm">
            {data.can.viewBilling
              ? "Upgrade for more members and support. Paid plans start with a 14-day trial."
              : "Ask an owner or billing manager about upgrading."}
          </p>
          {data.hrefs.billing ? (
            <Link
              className={buttonVariants({
                className:
                  "rounded-full bg-hero-action px-5 text-hero-action-foreground hover:bg-hero-action/90",
              })}
              href={data.hrefs.billing}
            >
              See plans
            </Link>
          ) : null}
        </div>
      </Tile>
    );
  }
  const status = STATUS_META[sub.status];
  const isTrial = sub.status === "trialing";
  const isPastDue = sub.status === "past_due";
  const when = isTrial ? sub.trialEndsAt : sub.currentPeriodEnd;
  const days = daysUntil(when);
  const label = sub.cancelAtPeriodEnd
    ? "Access ends"
    : isTrial
      ? "First charge"
      : isPastDue
        ? "Renewal failed"
        : "Next charge";
  return (
    <Tile className="grid content-between gap-8 border-0 bg-hero text-hero-foreground md:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <p className="font-medium text-hero-muted text-sm">
            {sub.planName} plan
          </p>
          <p className="font-medium text-sm">{label}</p>
        </div>
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-hero-tile px-2.5 font-medium text-xs">
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {status.label}
        </span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="grid gap-2">
          <Money label={sub.priceLabel} size="xl" />
          <p className="text-hero-muted text-sm tabular-nums">
            {formatDate(when)}
            {days !== null && days >= 0
              ? ` (in ${days} ${days === 1 ? "day" : "days"})`
              : ""}
            , billed per {intervalLabel(sub.interval, "long")}
          </p>
        </div>
        {data.hrefs.billing ? (
          <Link
            className={buttonVariants({
              className:
                "rounded-full bg-hero-action px-5 text-hero-action-foreground hover:bg-hero-action/90",
            })}
            href={data.hrefs.billing}
          >
            Manage billing
          </Link>
        ) : null}
      </div>
    </Tile>
  );
}

export function Dashboard({ data }: { data: DashboardData }) {
  const first = data.user.name.split(" ")[0] ?? data.user.name;
  const sub = data.subscription;
  const seatsUsed = data.members.total;
  const seatPct = Math.min(
    100,
    Math.round((seatsUsed / data.members.limit) * 100)
  );
  const rank = RANK[data.role] ?? 0;
  const inviteRoles = INVITABLE.filter((r) => (RANK[r] ?? 0) <= rank);

  return (
    <div className="grid animate-content gap-8">
      <PageHeader
        actions={
          data.can.invite ? (
            <InviteDialog
              organizationId={data.org.id}
              roles={inviteRoles}
              trigger={
                <Button className="h-10 rounded-full px-5">
                  <UserPlusIcon aria-hidden />
                  Invite teammate
                </Button>
              }
            />
          ) : null
        }
        description={`Here's how ${data.org.name} is set up today.`}
        title={`Welcome back, ${first}`}
      />

      {sub?.status === "past_due" ? (
        <div
          className="flex flex-col gap-4 rounded-[20px] border border-tone-warning-border bg-tone-warning p-5 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex gap-3">
            <AlertTriangleIcon
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-tone-warning-foreground"
            />
            <div className="grid gap-1">
              <p className="font-display font-semibold">
                The last renewal didn't go through
              </p>
              <p className="text-tone-warning-foreground text-sm">
                Update the card before {formatDate(sub.graceUntil)} to keep paid
                features on.
              </p>
            </div>
          </div>
          {data.can.manageBilling ? (
            <BillingAction
              action="manage-card"
              className="h-10 shrink-0 rounded-full px-5"
              orgId={data.org.id}
            >
              <CreditCardIcon aria-hidden />
              Update card
            </BillingAction>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <PlanTile data={data} />
        <Tile className="grid content-between gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-muted-foreground text-sm">Seats</h2>
            {data.hrefs.members ? (
              <Link
                className="rounded font-medium text-primary text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                href={data.hrefs.members}
              >
                Members
              </Link>
            ) : null}
          </div>
          <div className="grid gap-3">
            <p className="font-display tabular-nums leading-none tracking-tight">
              <span className="font-semibold text-[44px]">{seatsUsed}</span>
              <span className="text-muted-foreground text-xl">
                {" "}
                of {data.members.limit}
              </span>
            </p>
            <Progress
              aria-label="Seats used"
              className="h-2 bg-muted"
              value={seatPct}
            />
            <p className="text-muted-foreground text-sm">
              {data.pendingInvitations
                ? `${data.pendingInvitations} invitation${data.pendingInvitations === 1 ? "" : "s"} waiting`
                : "No pending invitations"}
            </p>
          </div>
        </Tile>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Tile
          className={cn(
            "grid content-start gap-5",
            data.can.viewBilling ? "md:col-span-1" : "md:col-span-3"
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-lg">Team</h2>
            <span className="text-muted-foreground text-sm tabular-nums">
              {data.members.total}{" "}
              {data.members.total === 1 ? "person" : "people"}
            </span>
          </div>
          <div aria-hidden className="-space-x-2 flex">
            {data.members.recent.map((m) => (
              <Monogram
                className="size-10 ring-2 ring-card"
                key={m.id}
                name={m.name}
                seed={m.email}
                shape="circle"
              />
            ))}
          </div>
          <ul className="grid gap-3">
            {data.members.recent.slice(0, 4).map((m) => (
              <li
                className="flex items-center justify-between gap-3 text-sm"
                key={m.id}
              >
                <span className="truncate">{m.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {roleLabel(m.role)}
                </span>
              </li>
            ))}
          </ul>
        </Tile>

        {data.can.viewBilling ? (
          <Tile className="grid content-start gap-5 md:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-lg">
                Recent payments
              </h2>
              {data.hrefs.billing ? (
                <Link
                  className="rounded font-medium text-primary text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  href={`${data.hrefs.billing}#invoices`}
                >
                  All invoices
                </Link>
              ) : null}
            </div>
            {data.recentInvoices.length ? (
              <ul className="-mx-2 grid">
                {data.recentInvoices.map((inv) => {
                  const meta = INVOICE_META[inv.status] ?? {
                    label: inv.status,
                    tone: "neutral" as const,
                  };
                  return (
                    <li
                      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-xl px-2 py-2.5 sm:grid-cols-[7rem_1fr_auto_6rem]"
                      key={inv.id}
                    >
                      <span className="text-muted-foreground text-sm tabular-nums">
                        {formatDate(inv.date)}
                      </span>
                      <span className="order-3 col-span-2 truncate text-sm sm:order-none sm:col-span-1">
                        {inv.description}
                      </span>
                      <span className="text-right font-display font-semibold tabular-nums">
                        {inv.amountLabel}
                      </span>
                      <span className="hidden justify-self-end sm:inline-flex">
                        <Chip tone={meta.tone}>{meta.label}</Chip>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                No payments yet. They show up here after the first charge.
              </p>
            )}
          </Tile>
        ) : null}
      </div>
    </div>
  );
}
