"use client";

import { catalog } from "@workspace/billing/catalog";
import {
  CURRENCIES,
  CURRENCY_SYMBOL,
  type Currency,
} from "@workspace/billing/money";
import { cn } from "@workspace/tailwind-config/utils";
import {
  CheckIcon,
  CircleCheckIcon,
  EyeOffIcon,
  LockIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useId, useRef, useState } from "react";

import { AnimatedNumber } from "@/components/animated-number";
import { useLanding } from "@/components/landing/currency-context";
import { nextRadioIndex } from "@/components/landing/radio";
import { type SegmentOption, Segmented } from "@/components/landing/segmented";
import { StatusBadge } from "@/components/primitives";
import { currencyMeta } from "@/lib/landing";
import { formatMoney } from "@/lib/money";

/* ------------------------------------------------------------- helpers */

const priceOf = (key: "starter" | "pro", currency: Currency) =>
  catalog
    .find((p) => p.key === key)
    ?.prices.find((p) => p.currency === currency && p.interval === "monthly")
    ?.amountSubunit ?? 0;

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
    "inline-flex h-9 items-center rounded-chip px-3 font-semibold text-[13px] transition-[background-color,color] duration-(--dur-fast)",
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
                "flex items-center justify-between gap-3 px-4 py-2.5 text-sm",
                i > 0 && "border-border border-t"
              )}
              key={p.name}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-chip font-semibold text-[11px]",
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
                <span className="text-muted-foreground text-xs capitalize">
                  {you ? role : p.role}
                </span>
                {you ? (
                  <span className="w-[4.25rem]" />
                ) : (
                  <span
                    className={cn(
                      "inline-flex w-[4.25rem] items-center justify-center gap-1 rounded-chip py-1 font-semibold text-xs",
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
          className="grid content-between gap-1.5 rounded-card bg-secondary p-4 text-sm"
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
        <div className="grid min-h-[9.5rem] content-between gap-3 rounded-card bg-secondary p-4 text-sm">
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
              <p className="font-semibold text-2xl tabular-nums tracking-[-0.02em]">
                ₦30,000
                <span className="font-normal text-muted-foreground text-sm">
                  {" "}
                  / month
                </span>
              </p>
              <span
                className={cn(
                  "inline-flex h-8 items-center justify-center gap-1.5 rounded-chip font-semibold text-xs",
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

/* ------------------------------------------------------------ checkout */

export function CheckoutDemo() {
  const { currency } = useLanding();
  const [open, setOpen] = useState(false);
  const amount = priceOf("pro", currency);
  return (
    <div
      className="relative"
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") {
          setOpen(false);
        }
      }}
    >
      <button
        aria-expanded={open}
        className="pressable flex h-11 w-full items-center justify-between gap-3 rounded-control bg-primary px-4 font-semibold text-[15px] text-primary-foreground hover:bg-primary-hover"
        onClick={() => setOpen((o) => !o)}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") {
            setOpen(true);
          }
        }}
        type="button"
      >
        Upgrade to Pro
        <span className="tabular-nums">{formatMoney(amount, currency)}</span>
      </button>
      {/* Resting state: what the server decided. The popup opens over it. */}
      <dl className="mt-3 grid gap-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Plan</dt>
          <dd>Pro, monthly</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Currency</dt>
          <dd>{currency}, locked at first checkout</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Amount set by</dt>
          <dd>your server</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Browser receives</dt>
          <dd className="font-mono text-[13px]">access_code</dd>
        </div>
      </dl>
      <div
        aria-hidden={!open}
        className={cn(
          "absolute inset-x-0 top-[3.25rem] z-10 origin-top rounded-card bg-popover p-4 text-popover-foreground shadow-[0_0_0_1px_var(--border),0_8px_24px_-8px_oklch(0.2_0.03_160/0.25)] transition-[opacity,scale] duration-(--dur-base) ease-(--ease-out)",
          open
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-[0.96] opacity-0"
        )}
        data-checkout-popup
      >
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold">Kola Logistics</span>
          <span className="text-muted-foreground text-xs">Test mode</span>
        </div>
        <p className="mt-2 font-semibold text-xl tabular-nums">
          Pay {formatMoney(amount, currency)}
        </p>
        <div className="mt-3 rounded-control px-3 py-2.5 font-mono text-[13px] shadow-[inset_0_0_0_1px_var(--input)]">
          4084 0840 8408 4081
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
      <label className="grid gap-2 text-sm" htmlFor={id}>
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
      <dl className="grid gap-1.5 text-sm">
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
            <Rolling amount={charge} className="text-lg" currency={currency} />
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
              "grid h-9 place-items-center rounded-chip font-semibold text-xs tabular-nums transition-colors duration-(--dur-base)",
              d < elapsed
                ? "bg-warning-bg text-warning"
                : state.kind === "paid"
                  ? "bg-success-bg text-success"
                  : "bg-secondary text-muted-foreground"
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
          "flex min-h-[4.25rem] items-start gap-2.5 rounded-card p-3 text-sm transition-colors duration-(--dur-base)",
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
          ) : state.kind === "paid" ? (
            "Card updated and charged. Pro is active."
          ) : (
            "Grace ended. Kola Logistics is on Free."
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge
          status={
            state.kind === "due"
              ? "past_due"
              : state.kind === "paid"
                ? "active"
                : "canceled"
          }
        />
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
                className="pressable pressable-sm inline-flex h-9 items-center rounded-chip bg-primary px-3 font-semibold text-[13px] text-primary-foreground hover:bg-primary-hover"
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

/* --------------------------------------------------------------- money */

const VIEWS: readonly SegmentOption<"shown" | "stored">[] = [
  { value: "shown", label: "Shown" },
  { value: "stored", label: "Stored" },
];

const SUBUNIT: Record<Currency, string> = {
  NGN: "kobo",
  GHS: "pesewas",
  ZAR: "cents",
  KES: "cents",
  USD: "cents",
};

export function MoneyDemo() {
  const { currency, setCurrency } = useLanding();
  const [view, setView] = useState<"shown" | "stored">("shown");
  const amount = priceOf("pro", currency);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Choice
          label="Currency"
          onChange={(c) => setCurrency(c)}
          options={CURRENCIES}
          render={(c, on) => (
            <span
              className={cn(
                chip(on),
                "w-9 justify-center px-0",
                c === "KES" && "text-[11px]"
              )}
            >
              {currencyMeta(c).glyph}
            </span>
          )}
          value={currency}
        />
        <Segmented
          className="w-[10.5rem]"
          label="View"
          onChange={setView}
          options={VIEWS}
          value={view}
        />
      </div>
      <div className="grid min-h-[4.5rem] content-center rounded-card bg-secondary px-4 py-3">
        {view === "shown" ? (
          <Rolling
            amount={amount}
            className="text-[28px] tracking-[-0.02em]"
            currency={currency}
          />
        ) : (
          <AnimatedNumber
            className="font-mono font-semibold text-[28px] tracking-[-0.02em]"
            format={{ useGrouping: false }}
            suffix={` ${SUBUNIT[currency]}`}
            value={amount}
          />
        )}
        <p className="mt-1 font-mono text-muted-foreground text-xs">
          {view === "shown"
            ? `formatMoney(${amount}, "${currency}")`
            : "stored as an integer, never a float"}
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- mock */

const MOCK_EVENTS = ["charge.success", "subscription.create", "invoice.create"];

export function MockDemo() {
  const [lines, setLines] = useState<{ id: number; text: string }[]>([
    { id: 1, text: "webhook subscription.create → 200" },
  ]);
  const next = useRef(2);
  const send = () => {
    const event = MOCK_EVENTS[(next.current - 1) % MOCK_EVENTS.length];
    const id = next.current++;
    setLines((l) => [...l, { id, text: `webhook ${event} → 200` }].slice(-3));
  };
  return (
    <div className="grid gap-3">
      <div
        aria-live="polite"
        className="grid content-start gap-0.5 rounded-card bg-[var(--neutral-950)] p-3.5 font-mono text-[12.5px] text-[var(--neutral-100)] leading-5"
      >
        <p>
          <span className="text-highlight">$</span> pnpm paystack:mock
        </p>
        <p className="truncate text-[var(--neutral-400)]">
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
                  {line.text.replace(" → 200", "")}{" "}
                  <span className="text-[var(--forest-300)]">→ 200</span>
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
          "justify-self-start font-mono"
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
  roles: RolesDemo,
  checkout: CheckoutDemo,
  proration: ProrationDemo,
  grace: GraceDemo,
  money: MoneyDemo,
  mock: MockDemo,
} as const;
