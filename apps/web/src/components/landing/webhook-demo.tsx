"use client";

import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/tailwind-config/utils";
import {
  CircleSlashIcon,
  CopyCheckIcon,
  GlobeIcon,
  ShieldCheckIcon,
  WebhookIcon,
} from "lucide-react";
import { useRef, useState } from "react";

import { Money, Panel, StatusBadge } from "@/components/primitives";
import { formatMoney } from "@/lib/money";

type Outcome = "verified" | "ignored" | "duplicate";
type LogRow = {
  id: number;
  time: string;
  event: string;
  detail: string;
  outcome: Outcome;
  fresh?: boolean;
};

const PRO = 3_000_000;
const VISIBLE_ROWS = 5;

/** Seed rows use fixed times so the server and client render the same HTML. */
const SEED: LogRow[] = [
  {
    id: 5,
    time: "09:41:07",
    event: "charge.success",
    detail: "₦30,000.00, ref T7Q2K9X4",
    outcome: "verified",
  },
  {
    id: 4,
    time: "09:41:03",
    event: "POST /api/plan",
    detail: '{"plan":"pro"} from the browser',
    outcome: "ignored",
  },
  {
    id: 3,
    time: "09:40:58",
    event: "invoice.create",
    detail: "Next charge ₦30,000.00",
    outcome: "verified",
  },
  {
    id: 2,
    time: "09:40:51",
    event: "charge.success",
    detail: "₦30,000.00, ref T5B8M1C2",
    outcome: "verified",
  },
  {
    id: 1,
    time: "09:40:44",
    event: "subscription.create",
    detail: "Pro, card saved",
    outcome: "verified",
  },
];

const OUTCOME = {
  verified: { label: "Verified", icon: ShieldCheckIcon, variant: "success" },
  ignored: { label: "Ignored", icon: CircleSlashIcon, variant: "destructive" },
  duplicate: { label: "Duplicate", icon: CopyCheckIcon, variant: "quiet" },
} as const;

const clock = () => new Date().toLocaleTimeString("en-GB", { hour12: false });

/**
 * The starter's promise, as something you can poke: send Paystack events and
 * watch the billing panel change, then try the same from "the browser" and
 * watch nothing happen. Every third charge is a retry of the last one, which
 * the starter stores once and skips.
 */
export function WebhookDemo() {
  const [rows, setRows] = useState<LogRow[]>(SEED);
  const [collected, setCollected] = useState(PRO * 2);
  const [status, setStatus] = useState<"active" | "past_due">("active");
  const [note, setNote] = useState("Next charge ₦30,000.00 in 30 days");
  const next = useRef(SEED.length + 1);
  const charges = useRef(0);
  const lastRef = useRef("T7Q2K9X4");

  const log = (row: Omit<LogRow, "id" | "time" | "fresh">) => {
    const id = next.current++;
    setRows((prev) =>
      [
        { ...row, id, time: clock(), fresh: true },
        ...prev.map((r) => ({ ...r, fresh: false })),
      ].slice(0, VISIBLE_ROWS)
    );
  };

  const charge = () => {
    charges.current += 1;
    if (charges.current % 3 === 0) {
      log({
        event: "charge.success",
        detail: `Retry of ref ${lastRef.current}, stored once`,
        outcome: "duplicate",
      });
      return;
    }
    const ref = `T${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    lastRef.current = ref;
    setCollected((c) => c + PRO);
    setStatus("active");
    setNote("Next charge ₦30,000.00 in 30 days");
    log({
      event: "charge.success",
      detail: `₦30,000.00, ref ${ref}`,
      outcome: "verified",
    });
  };

  const fail = () => {
    setStatus("past_due");
    setNote("Card declined. Update it within 7 days to keep Pro");
    log({
      event: "invoice.payment_failed",
      detail: "Card declined, 7 days of grace",
      outcome: "verified",
    });
  };

  const forge = () =>
    log({
      event: "POST /api/plan",
      detail: "No signature. Nothing changed",
      outcome: "ignored",
    });

  return (
    <div className="grid min-w-0 gap-3">
      <Panel as="div" className="grid gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-panel-muted text-sm">Kola Logistics · Pro plan</p>
          <span aria-live="polite">
            <StatusBadge status={status} />
          </span>
        </div>
        <div className="grid gap-1.5">
          <p className="text-panel-muted text-sm">Collected this year</p>
          <Money label={formatMoney(collected, "NGN")} size="xl" />
        </div>
        <p className="min-h-[1lh] text-panel-muted text-sm">{note}</p>
      </Panel>

      <div className="overflow-hidden rounded-tile bg-card shadow-tile">
        <div className="flex flex-wrap gap-2 border-border border-b p-3">
          <DemoButton icon={WebhookIcon} onClick={charge}>
            charge.success
          </DemoButton>
          <DemoButton icon={WebhookIcon} onClick={fail}>
            invoice.payment_failed
          </DemoButton>
          <DemoButton
            className="font-sans text-destructive text-sm"
            icon={GlobeIcon}
            onClick={forge}
          >
            Set plan from the browser
          </DemoButton>
        </div>
        <ol
          aria-label="Webhook log"
          aria-live="polite"
          className="grid"
          style={{ gridTemplateRows: `repeat(${VISIBLE_ROWS}, 3.5rem)` }}
        >
          {rows.map((row) => {
            const o = OUTCOME[row.outcome];
            return (
              <li
                className="grid min-w-0 grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-3 border-border border-t px-4 text-sm first:border-t-0 max-sm:grid-cols-[minmax(0,1fr)_auto]"
                data-presence={row.fresh ? "entering" : undefined}
                key={row.id}
              >
                <time className="text-muted-foreground tabular-nums max-sm:hidden">
                  {row.time}
                </time>
                <span className="min-w-0 truncate">
                  <code
                    className={cn(
                      "font-medium font-mono text-[13px]",
                      row.outcome === "ignored" &&
                        "text-muted-foreground line-through"
                    )}
                  >
                    {row.event}
                  </code>{" "}
                  <span className="text-muted-foreground">{row.detail}</span>
                </span>
                <Badge variant={o.variant}>
                  <o.icon aria-hidden />
                  {o.label}
                </Badge>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function DemoButton({
  children,
  icon: Icon,
  onClick,
  className,
}: {
  children: string;
  icon: typeof WebhookIcon;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      className={cn(
        "inline-flex h-10 touch-manipulation items-center gap-1.5 rounded-control bg-secondary px-3 font-medium font-mono text-[13px] transition-[background-color,scale] duration-(--dur-fast) ease-out hover:bg-accent active:scale-[0.97]",
        className
      )}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden className="size-4" />
      {children}
    </button>
  );
}
