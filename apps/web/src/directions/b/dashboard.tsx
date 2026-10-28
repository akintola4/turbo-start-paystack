import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/tailwind-config/utils";
import { UserPlusIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Monogram } from "@/components/shared/avatars";
import type { DashboardData } from "@/directions/types";
import {
  daysUntil,
  formatDate,
  INVOICE_META,
  intervalLabel,
  roleLabel,
  STATUS_META,
  type Tone,
} from "@/lib/format";
import { Dot, money, PageHeader, Pill } from "./primitives";

const REASON: Record<string, string> = {
  no_subscription: "No paid subscription. Paid features are off.",
  trialing: "Trial in progress. Paid features are on.",
  active: "Subscription active. Paid features are on.",
  non_renewing:
    "Cancels at the end of the period. Paid features stay on until then.",
  past_due_grace:
    "Renewal failed. Paid features stay on during the grace period.",
  period_ended: "The period ended without a renewal. Paid features are off.",
  grace_ended: "The grace period ended. Paid features are off.",
  canceled: "Subscription canceled. Paid features are off.",
};

function Stat({
  label,
  value,
  detail,
  children,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid content-start gap-1 bg-card px-4 py-3.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="font-display font-semibold text-[20px] leading-7 tracking-[-0.02em] tabular-nums">
        {value}
      </span>
      {detail ? (
        <span className="text-[12px] text-muted-foreground">{detail}</span>
      ) : null}
      {children}
    </div>
  );
}

type Activity = {
  at: string;
  tone: Tone;
  title: ReactNode;
  meta: ReactNode;
  key: string;
};

function activity(data: DashboardData): Activity[] {
  const items: Activity[] = [
    ...data.recentInvoices.map((inv) => ({
      key: `inv-${inv.id}`,
      at: inv.date,
      tone: INVOICE_META[inv.status]?.tone ?? "neutral",
      title: (
        <>
          {inv.description}{" "}
          <span className="text-muted-foreground">
            {inv.status === "failed"
              ? "failed"
              : (INVOICE_META[inv.status]?.label ?? inv.status).toLowerCase()}
          </span>
        </>
      ),
      meta: <span className="tabular-nums">{money(inv.amountLabel)}</span>,
    })),
    ...data.members.recent.map((m) => ({
      key: `mem-${m.id}`,
      at: m.joinedAt,
      tone: "neutral" as Tone,
      title: (
        <>
          {m.name}{" "}
          <span className="text-muted-foreground">
            joined as {roleLabel(m.role).toLowerCase()}
          </span>
        </>
      ),
      meta: null,
    })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
}

export function Dashboard({ data }: { data: DashboardData }) {
  const sub = data.subscription;
  const status = STATUS_META[sub?.status ?? "free"];
  const seatsPct = Math.min(
    100,
    Math.round((data.members.total / Math.max(1, data.members.limit)) * 100)
  );
  const events = activity(data);
  const trialDays =
    sub?.status === "trialing" ? daysUntil(sub.trialEndsAt) : null;
  const graceDays =
    sub?.status === "past_due" ? daysUntil(sub.graceUntil) : null;

  return (
    <div className="grid gap-8">
      <PageHeader
        actions={
          data.can.invite ? (
            <Button asChild className="h-8" size="sm" variant="outline">
              <Link href={`${data.hrefs.members}?invite=1`}>
                <UserPlusIcon />
                Invite
              </Link>
            </Button>
          ) : null
        }
        description={`Welcome back, ${data.user.name.split(" ")[0]}.`}
        title="Overview"
      />

      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-3 text-[13px]",
          data.entitlement.active ? "bg-card" : "bg-muted/40"
        )}
        data-testid="entitlement"
      >
        <Pill tone={data.entitlement.active ? "positive" : "neutral"}>
          {data.entitlement.active ? "Paid features on" : "Paid features off"}
        </Pill>
        <span className="font-medium">{data.entitlement.planName}</span>
        <span className="min-w-0 basis-full text-muted-foreground sm:basis-auto sm:flex-1">
          {REASON[data.entitlement.reason] ??
            data.entitlement.reason.replaceAll("_", " ")}
        </span>
        {graceDays !== null && data.hrefs.billing ? (
          <Button asChild className="h-7" size="sm">
            <Link href={data.hrefs.billing}>Update card</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
        <Stat
          detail={
            sub
              ? `${money(sub.priceLabel)} / ${intervalLabel(sub.interval)}`
              : "No subscription"
          }
          label="Plan"
          value={
            <span className="flex items-center gap-2">
              {data.entitlement.planName}
              {sub ? (
                <Pill className="font-sans" tone={status.tone}>
                  {status.label}
                </Pill>
              ) : null}
            </span>
          }
        />
        <Stat
          detail={
            sub?.cancelAtPeriodEnd
              ? `Access ends ${formatDate(sub.currentPeriodEnd)}`
              : trialDays !== null
                ? `Trial ends in ${trialDays} days`
                : graceDays !== null
                  ? `Grace ends in ${Math.max(0, graceDays)} days`
                  : sub
                    ? `On ${formatDate(sub.currentPeriodEnd)}`
                    : data.can.viewBilling
                      ? "Choose a plan in billing"
                      : "Ask a billing manager"
          }
          label={sub?.cancelAtPeriodEnd ? "Next charge" : "Next charge"}
          value={sub && !sub.cancelAtPeriodEnd ? money(sub.priceLabel) : "—"}
        />
        <Stat
          detail={`${data.members.limit - data.members.total} seats left on ${data.entitlement.planName}`}
          label="Seats"
          value={
            <>
              {data.members.total}
              <span className="font-normal text-[14px] text-muted-foreground">
                {" "}
                / {data.members.limit}
              </span>
            </>
          }
        >
          <div
            aria-label={`${seatsPct}% of seats used`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={seatsPct}
            className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-foreground/70"
              style={{ width: `${seatsPct}%` }}
            />
          </div>
        </Stat>
        <Stat
          detail={
            data.pendingInvitations ? "Waiting to be accepted" : "None waiting"
          }
          label="Pending invites"
          value={data.pendingInvitations}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section
          aria-labelledby="activity-title"
          className="grid content-start gap-3"
        >
          <div className="flex h-7 items-center justify-between">
            <h2 className="font-medium text-[14px]" id="activity-title">
              Activity
            </h2>
            {data.hrefs.billing ? (
              <Link
                className="text-[12.5px] text-muted-foreground hover:text-foreground"
                href={data.hrefs.billing}
              >
                Billing history
              </Link>
            ) : null}
          </div>
          {events.length ? (
            <ol className="relative grid">
              {events.map((e, i) => (
                <li
                  className="relative grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-3 py-2"
                  key={e.key}
                >
                  {i < events.length - 1 ? (
                    <span
                      aria-hidden
                      className="absolute top-[22px] bottom-[-10px] left-[7.5px] w-px bg-foreground/12"
                    />
                  ) : null}
                  <span className="mt-[5px] flex size-4 items-center justify-center">
                    <Dot
                      className="size-2 ring-4 ring-background"
                      tone={e.tone}
                    />
                  </span>
                  <div className="grid min-w-0 gap-0.5">
                    <p className="truncate text-[13px]">{e.title}</p>
                    <p className="font-mono text-[11.5px] text-muted-foreground tabular-nums">
                      {formatDate(e.at)}
                    </p>
                  </div>
                  <span className="pt-px text-[13px]">{e.meta}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-[13px] text-muted-foreground">
              Nothing yet. Payments and new members show up here.
            </p>
          )}
        </section>

        <section
          aria-labelledby="team-title"
          className="grid content-start gap-3"
        >
          <div className="flex h-7 items-center justify-between">
            <h2 className="font-medium text-[14px]" id="team-title">
              Newest members
            </h2>
            <Link
              className="text-[12.5px] text-muted-foreground hover:text-foreground"
              href={data.hrefs.members}
            >
              View all
            </Link>
          </div>
          <ul className="divide-y rounded-lg border">
            {data.members.recent.map((m) => (
              <li className="flex items-center gap-3 px-3 py-2" key={m.id}>
                <Monogram
                  className="size-6 text-[10px]"
                  name={m.name}
                  seed={m.email}
                  shape="circle"
                  tone="mono"
                />
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {m.name}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {roleLabel(m.role)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
