"use client";

import { catalog } from "@workspace/billing/catalog";
import type { Currency } from "@workspace/billing/money";
import { cn } from "@workspace/tailwind-config/utils";
import {
  CheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  EyeOffIcon,
  LockIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { AnimatedNumber } from "@/components/animated-number";
import { useLanding } from "@/components/landing/currency-context";
import { nextRadioIndex } from "@/components/landing/radio";
import { type SegmentOption, Segmented } from "@/components/landing/segmented";
import { StatusBadge } from "@/components/primitives";
import { CURRENCY_SYMBOL, formatMoney } from "@/lib/money";

/* ------------------------------------------------------------- helpers */

/** A monthly catalog price; a missing one is a catalog bug, so it throws. */
function priceOf(key: "starter" | "pro", currency: Currency): number {
  const amount = catalog
    .find((p) => p.key === key)
    ?.prices.find(
      (p) => p.currency === currency && p.interval === "monthly"
    )?.amountSubunit;
  if (amount === undefined) {
    throw new Error(`No monthly ${key} price in ${currency}`);
  }
  return amount;
}

/** An amount that rolls with NumberFlow and reads as plain text. */
function Rolling({
  amount,
  currency,
  className,
  negative = false,
}: {
  amount: number;
  currency: Currency;
  className?: string;
  negative?: boolean;
}) {
  return (
    <AnimatedNumber
      className={cn("font-semibold tabular-nums", className)}
      format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
      kind="money"
      label={`${negative ? "minus " : ""}${formatMoney(amount, currency)}`}
      prefix={`${negative ? "−" : ""}${CURRENCY_SYMBOL[currency]}`}
      value={amount / 100}
    />
  );
}

/** A small radio group with roving focus (arrow keys, one tab stop). */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  render,
  className,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  render: (value: T, on: boolean) => React.ReactNode;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = options.indexOf(value);
  return (
    <div
      aria-label={label}
      className={cn("flex flex-wrap gap-1.5", className)}
      onKeyDown={(e) => {
        const next = nextRadioIndex(e, index, options.length);
        const v = next === null ? undefined : options[next];
        if (next !== null && v !== undefined) {
          onChange(v);
          refs.current[next]?.focus();
        }
      }}
      role="radiogroup"
    >
      {options.map((o, i) => (
        // biome-ignore lint/a11y/useSemanticElements: ARIA radio group with roving focus.
        <button
          aria-checked={o === value}
          className="pressable pressable-sm rounded-chip"
          key={o}
          onClick={() => onChange(o)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="radio"
          tabIndex={o === value ? 0 : -1}
          type="button"
        >
          {render(o, o === value)}
        </button>
      ))}
    </div>
  );
}

const chip = (on: boolean) =>
  cn(
    "inline-flex h-10 items-center rounded-chip px-3 font-semibold text-[15px] transition-[background-color,color] duration-(--dur-fast)",
    on
      ? "bg-highlight text-highlight-foreground"
      : "bg-secondary text-foreground hover:bg-accent"
  );

/* --------------------------------------------------------------- roles */

const ROLES = ["owner", "admin", "billing", "member", "viewer"] as const;
type Role = (typeof ROLES)[number];

/** From packages/auth/src/roles.ts. */
const PERMISSIONS: { label: string; roles: Role[]; billing?: boolean }[] = [
  {
    label: "See billing and invoices",
    roles: ["owner", "admin", "billing"],
    billing: true,
  },
  {
    label: "Change the plan and card",
    roles: ["owner", "billing"],
    billing: true,
  },
  { label: "Invite people", roles: ["owner", "admin"] },
  { label: "Remove members", roles: ["owner", "admin"] },
  { label: "Delete the organization", roles: ["owner"] },
];

const PEOPLE: { initials: string; name: string; role: Role | "you" }[] = [
  { initials: "AO", name: "Ada Obi", role: "you" },
  { initials: "KM", name: "Kofi Mensah", role: "member" },
  { initials: "TN", name: "Thandi Nkosi", role: "billing" },
];

export function RolesDemo() {
  const { currency } = useLanding();
  const [role, setRole] = useState<Role>("admin");
  const noBilling = role === "member" || role === "viewer";
  const canManageBilling = role === "owner" || role === "billing";
  const canRemove = role === "owner" || role === "admin";
  return (
    <div className="grid flex-1 grid-rows-[auto_auto_1fr] gap-4">
      <Choice
        label="Your role"
        onChange={setRole}
        options={ROLES}
        render={(r, on) => (
          <span className={cn(chip(on), "capitalize")}>{r}</span>
        )}
        value={role}
      />
      <ul
        aria-label="Members"
        className="grid overflow-hidden rounded-card bg-secondary"
      >
        {PEOPLE.map((p, i) => {
          const you = p.role === "you";
          return (
            <li
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-2.5 text-[17px] leading-[26px]",
                i > 0 && "border-border border-t"
              )}
              key={p.name}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-chip font-semibold text-xs",
                    you ? "bg-highlight text-highlight-foreground" : "bg-accent"
                  )}
                >
                  {p.initials}
                </span>
                <span className="min-w-0 truncate font-medium">
                  {p.name}
                  {you ? (
                    <span className="text-muted-foreground"> (you)</span>
                  ) : null}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-muted-foreground text-sm capitalize">
                  {you ? role : p.role}
                </span>
                {you ? (
                  <span className="w-[4.25rem]" />
                ) : (
                  <span
                    className={cn(
                      "inline-flex w-[4.25rem] items-center justify-center gap-1 rounded-chip py-1 font-semibold text-sm",
                      canRemove
                        ? "bg-card text-foreground shadow-tile"
                        : "text-muted-foreground"
                    )}
                  >
                    {canRemove ? null : (
                      <LockIcon aria-hidden className="size-3" />
                    )}
                    Remove
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <ul
          aria-live="polite"
          className="grid content-between gap-1.5 rounded-card bg-secondary p-4 text-[17px] leading-[26px]"
        >
          {PERMISSIONS.map((p) => {
            const allowed = p.roles.includes(role);
            const hidden = p.billing && noBilling;
            return (
              <li
                className={cn(
                  "flex items-center gap-2.5 transition-colors duration-(--dur-fast)",
                  allowed ? "text-foreground" : "text-muted-foreground"
                )}
                key={p.label}
              >
                {hidden ? (
                  <EyeOffIcon aria-hidden className="size-4 shrink-0" />
                ) : allowed ? (
                  <CheckIcon
                    aria-hidden
                    className="size-4 shrink-0 text-success"
                  />
                ) : (
                  <LockIcon aria-hidden className="size-4 shrink-0" />
                )}
                <span className="truncate">
                  {hidden ? "Billing is hidden" : p.label}
                </span>
                <span className="sr-only">
                  {allowed ? "(allowed)" : "(not allowed)"}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="grid min-h-[9.5rem] content-between gap-3 rounded-card bg-secondary p-4 text-[17px] leading-[26px]">
          {noBilling ? (
            <p className="flex items-center gap-2 self-center text-muted-foreground">
              <EyeOffIcon aria-hidden className="size-4 shrink-0" />
              {role === "viewer" ? "Viewers" : "Members"} never see billing.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Billing</span>
                <StatusBadge status="active" />
              </div>
              <p className="font-semibold text-[30px] leading-9 tabular-nums tracking-[-0.02em]">
                {formatMoney(priceOf("pro", currency), currency).replace(
                  /\.00$/,
                  ""
                )}
                <span className="font-normal text-muted-foreground text-[17px] leading-[26px]">
                  {" "}
                  / month
                </span>
              </p>
              <span
                className={cn(
                  "inline-flex h-8 items-center justify-center gap-1.5 rounded-chip font-semibold text-sm",
                  canManageBilling
                    ? "bg-highlight text-highlight-foreground"
                    : "text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                )}
              >
                {canManageBilling ? (
                  "Change plan"
                ) : (
                  <>
                    <LockIcon aria-hidden className="size-3" />
                    View only
                  </>
                )}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- proration */

export function ProrationDemo() {
  const { currency } = useLanding();
  const [day, setDay] = useState(12);
  const id = useId();
  const oldAmount = priceOf("starter", currency);
  const newAmount = priceOf("pro", currency);
  const left = (30 - day) / 30;
  const credit = Math.round(oldAmount * left);
  const cost = Math.round(newAmount * left);
  const charge = Math.max(0, cost - credit);
  return (
    <div className="grid gap-3">
      <label className="grid gap-2 text-[17px] leading-[26px]" htmlFor={id}>
        <span className="flex justify-between gap-3">
          <span className="text-muted-foreground">
            Upgrade Starter to Pro on
          </span>
          <span className="font-semibold tabular-nums">day {day} of 30</span>
        </span>
        <input
          className="h-11 w-full cursor-pointer touch-manipulation accent-[var(--highlight)]"
          id={id}
          max={29}
          min={1}
          onChange={(e) => setDay(Number(e.target.value))}
          type="range"
          value={day}
        />
      </label>
      <dl className="grid gap-1.5 text-[17px] leading-[26px]">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Unused Starter</dt>
          <dd>
            <Rolling amount={credit} currency={currency} negative />
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Pro for the days left</dt>
          <dd>
            <Rolling amount={cost} currency={currency} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-border border-t pt-2">
          <dt className="font-semibold">Charged now</dt>
          <dd>
            <Rolling
              amount={charge}
              className="text-[22px] leading-7"
              currency={currency}
            />
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* --------------------------------------------------------------- grace */

type GraceState =
  | { kind: "due"; days: number }
  | { kind: "paid" }
  | { kind: "ended" };

const GRACE_STATUS = {
  due: "past_due",
  paid: "active",
  ended: "canceled",
} as const;

const GRACE_MESSAGE = {
  paid: "Card updated and charged. Pro is active.",
  ended: "Grace ended. Kola Logistics is on Free.",
} as const;

function dayTone(passed: boolean, kind: GraceState["kind"]) {
  if (passed) {
    return "bg-warning-bg text-warning";
  }
  return kind === "paid"
    ? "bg-success-bg text-success"
    : "bg-secondary text-muted-foreground";
}

export function GraceDemo() {
  const [state, setState] = useState<GraceState>({ kind: "due", days: 7 });
  const nextDay = () =>
    setState((s) =>
      s.kind === "due"
        ? s.days > 1
          ? { kind: "due", days: s.days - 1 }
          : { kind: "ended" }
        : s
    );
  const elapsed =
    state.kind === "due" ? 7 - state.days : state.kind === "ended" ? 7 : 0;
  return (
    <div className="grid gap-3">
      <ol aria-label="Grace period" className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }, (_, d) => (
          <li
            className={cn(
              "grid h-10 place-items-center rounded-chip font-semibold text-sm tabular-nums transition-colors duration-(--dur-base)",
              dayTone(d < elapsed, state.kind)
            )}
            key={d}
          >
            <span className="sr-only">Day </span>
            {d + 1}
          </li>
        ))}
      </ol>
      <div
        aria-live="polite"
        className={cn(
          "flex min-h-[4.25rem] items-start gap-2.5 rounded-card p-3 text-[17px] leading-[26px] transition-colors duration-(--dur-base)",
          state.kind === "due" && "bg-warning-bg text-warning",
          state.kind === "paid" && "bg-success-bg text-success",
          state.kind === "ended" && "bg-quiet-bg text-quiet"
        )}
      >
        {state.kind === "paid" ? (
          <CircleCheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        ) : (
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        )}
        <p>
          {state.kind === "due" ? (
            <>
              Payment failed. Update your card within{" "}
              <AnimatedNumber className="font-semibold" value={state.days} />{" "}
              {state.days === 1 ? "day" : "days"} to keep Pro.
            </>
          ) : (
            GRACE_MESSAGE[state.kind]
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge status={GRACE_STATUS[state.kind]} />
        <div className="flex gap-1.5">
          {state.kind === "due" ? (
            <>
              <button
                className={cn("pressable pressable-sm", chip(false))}
                onClick={nextDay}
                type="button"
              >
                Next day
              </button>
              <button
                className="pressable pressable-sm inline-flex h-10 items-center rounded-chip bg-primary px-3 font-semibold text-[15px] text-primary-foreground hover:bg-primary-hover"
                onClick={() => setState({ kind: "paid" })}
                type="button"
              >
                Update card
              </button>
            </>
          ) : (
            <button
              className={cn("pressable pressable-sm", chip(false))}
              onClick={() => setState({ kind: "due", days: 7 })}
              type="button"
            >
              Start over
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- swaps */

type StepState = "waiting" | "done" | "failed" | "skipped";

const STEP_ICON = {
  waiting: CircleDashedIcon,
  done: CircleCheckIcon,
  failed: CircleXIcon,
  skipped: CircleDashedIcon,
} as const;

const STEP_TONE: Record<StepState, string> = {
  waiting: "text-muted-foreground",
  done: "text-success",
  failed: "text-destructive",
  skipped: "text-muted-foreground",
};

function Steps({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <ol className="grid gap-1.5 rounded-card bg-secondary p-4 text-[17px] leading-[26px]">
      {steps.map((step, i) => {
        const Icon = STEP_ICON[step.state];
        return (
          <li className="flex items-center gap-2.5" key={step.label}>
            <Icon
              aria-hidden
              className={cn("size-4 shrink-0", STEP_TONE[step.state])}
            />
            <span
              className={cn(
                "min-w-0",
                step.state === "skipped" && "text-muted-foreground line-through"
              )}
            >
              {i + 1}. {step.label}
            </span>
            <span className="sr-only">({step.state})</span>
          </li>
        );
      })}
    </ol>
  );
}

// Short labels: "Paystack answers" needs 133px a segment, and a 320px
// phone gives it 108. The group's label names Paystack.
const PAYSTACK: readonly SegmentOption<"answers" | "fails">[] = [
  { value: "answers", label: "Answers" },
  { value: "fails", label: "Fails" },
];

const SWAP_STEP_MS = 450;

export function SwapDemo() {
  const [paystack, setPaystack] = useState<"answers" | "fails">("answers");
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const fails = paystack === "fails";

  const run = () => {
    clearTimeout(timer.current);
    setProgress(1);
    timer.current = setTimeout(() => setProgress(2), SWAP_STEP_MS);
  };
  const choose = (value: "answers" | "fails") => {
    clearTimeout(timer.current);
    setPaystack(value);
    setProgress(0);
  };

  const first: StepState = progress < 1 ? "waiting" : fails ? "failed" : "done";
  const second: StepState =
    progress < 2 ? "waiting" : fails ? "skipped" : "done";
  const result =
    progress < 2
      ? null
      : fails
        ? "Still on Starter. The proration charge was refunded."
        : "On Pro now. The billing date did not move.";

  return (
    <div className="grid gap-3">
      <Segmented
        className="w-full sm:w-[19rem]"
        label="Paystack's answer"
        onChange={choose}
        options={PAYSTACK}
        value={paystack}
      />
      <Steps
        steps={[
          { label: "Create the Pro subscription on Paystack", state: first },
          { label: "Retire the Starter subscription", state: second },
        ]}
      />
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="min-w-0 text-[17px] leading-[26px]">
          {result ?? (
            <span className="text-muted-foreground">
              Starter to Pro, mid-period.
            </span>
          )}
        </p>
        <button
          className={cn("pressable pressable-sm", chip(false))}
          onClick={run}
          type="button"
        >
          {progress === 0 ? "Switch to Pro" : "Run again"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ ordering */

const ORDERS: readonly SegmentOption<"sent" | "shuffled">[] = [
  { value: "sent", label: "As sent" },
  { value: "shuffled", label: "Out of order" },
];

/** The events a Starter-to-Pro swap produces, in the order Paystack sent them. */
const SWAP_EVENTS = [
  { event: "subscription.create", ref: "Pro", outcome: "Pro is active" },
  { event: "charge.success", ref: "Pro", outcome: "Payment stored once" },
  {
    event: "subscription.disable",
    ref: "Starter",
    outcome: "Retired in the swap, ignored",
  },
] as const;

export function OrderingDemo() {
  const [order, setOrder] = useState<"sent" | "shuffled">("shuffled");
  const events =
    order === "sent"
      ? SWAP_EVENTS
      : [SWAP_EVENTS[2], SWAP_EVENTS[0], SWAP_EVENTS[1]];
  return (
    <div className="grid gap-3">
      <Segmented
        className="w-full sm:w-[16rem]"
        label="Delivery order"
        onChange={setOrder}
        options={ORDERS}
        value={order}
      />
      <ol
        aria-live="polite"
        className="grid gap-1.5 rounded-card bg-secondary p-4 text-[17px] leading-[26px]"
      >
        {events.map((e) => (
          <li
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
            key={e.event}
          >
            <code className="truncate font-mono text-[15px]">
              {e.event} <span className="text-muted-foreground">({e.ref})</span>
            </code>
            <span className="text-muted-foreground text-sm">{e.outcome}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[17px] leading-[26px]">
        <span className="text-muted-foreground">Either order ends on</span>
        <StatusBadge label="Pro, active" status="active" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- mock */

const MOCK_EVENTS = ["charge.success", "subscription.create", "invoice.create"];

export function MockDemo() {
  const [lines, setLines] = useState<{ id: number; event: string }[]>([
    { id: 1, event: "subscription.create" },
  ]);
  const next = useRef(2);
  const send = () => {
    const id = next.current++;
    const event =
      MOCK_EVENTS[(id - 1) % MOCK_EVENTS.length] ?? "charge.success";
    setLines((l) => [...l, { id, event }].slice(-3));
  };
  return (
    <div className="grid gap-3">
      <div
        aria-live="polite"
        className="grid content-start gap-0.5 rounded-card bg-(--code-bg) p-3.5 font-mono text-(--code-text) text-sm leading-[22px]"
      >
        <p>
          <span className="text-highlight">$</span> pnpm paystack:mock
        </p>
        <p className="truncate text-(--code-comment)">
          Mock Paystack on http://localhost:4010
        </p>
        {/* Three fixed slots so new lines never change the height. */}
        {[0, 1, 2].map((slot) => {
          const line = lines[slot];
          return (
            <p
              className={cn(
                "min-h-5 truncate",
                line?.id === next.current - 1 && "animate-swap"
              )}
              key={line?.id ?? `empty-${slot}`}
            >
              {line ? (
                <>
                  webhook {line.event}{" "}
                  <span className="text-(--code-string)">→ 200</span>
                </>
              ) : null}
            </p>
          );
        })}
      </div>
      <button
        className={cn(
          "pressable pressable-sm",
          chip(false),
          "justify-self-start"
        )}
        onClick={send}
        type="button"
      >
        Send a signed webhook
      </button>
    </div>
  );
}

export const DEMOS = {
  proration: ProrationDemo,
  swaps: SwapDemo,
  ordering: OrderingDemo,
  grace: GraceDemo,
  roles: RolesDemo,
  mock: MockDemo,
} as const;
