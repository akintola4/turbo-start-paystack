"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import {
  CalendarRangeIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  FastForwardIcon,
  FlaskConicalIcon,
  HourglassIcon,
  Loader2Icon,
  type LucideIcon,
  MailIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "@/lib/toast";

import { toastKindFor } from "@/lib/dev-log";
import type { SubscriptionStatus } from "@/lib/view-models";

type Action =
  | "renew"
  | "fail"
  | "recover"
  | "end-trial"
  | "duplicate"
  | "forged";

type LogEntry = {
  id?: string;
  event: string;
  status: number | null;
  outcome: string;
  tone: "ok" | "ignored" | "rejected" | "error";
};

type Run = {
  id: number;
  label: string;
  at: string;
  entries: LogEntry[];
  error?: string;
};

type Email = { id: string; to: string; subject: string; sentAt: string };

type StepState = "pending" | "running" | "done" | "failed";

const ACTIONS: {
  action: Action;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    action: "renew",
    label: "Fast-forward to renewal",
    hint: "charge.success + invoice.update",
    icon: FastForwardIcon,
  },
  {
    action: "fail",
    label: "Fail the next renewal",
    hint: "invoice.payment_failed → past due",
    icon: XIcon,
  },
  {
    action: "recover",
    label: "Recover",
    hint: "The retry goes through → active",
    icon: RotateCcwIcon,
  },
  {
    action: "end-trial",
    label: "End the trial",
    hint: "Reminder email, then the first charge",
    icon: HourglassIcon,
  },
  {
    action: "duplicate",
    label: "Duplicate the last event",
    hint: "Same body again → ignored",
    icon: CopyIcon,
  },
  {
    action: "forged",
    label: "Forged webhook",
    hint: "Wrong signature → 401",
    icon: ShieldAlertIcon,
  },
];

const MONTH: { action: Action; label: string }[] = [
  { action: "renew", label: "Renewal" },
  { action: "fail", label: "Failed renewal" },
  { action: "recover", label: "Recovery" },
];

const LABEL: Record<Action, string> = Object.fromEntries(
  ACTIONS.map((a) => [a.action, a.label])
) as Record<Action, string>;

const STATUS_WORD: Partial<Record<SubscriptionStatus, string>> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  non_renewing: "Non-renewing",
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

function disabledReason(
  action: Action,
  status: SubscriptionStatus | null
): string | null {
  if (!status || status === "canceled" || status === "expired") {
    return "Subscribe first";
  }
  if (action === "recover" && status !== "past_due") {
    return "Fail a renewal first";
  }
  if (action === "end-trial" && status !== "trialing") {
    return "Not on a trial";
  }
  return null;
}

function StatusChip({ entry }: { entry: LogEntry }) {
  if (entry.status === null) {
    return (
      <Badge className="font-mono" variant="quiet">
        cron
      </Badge>
    );
  }
  const variant =
    entry.tone === "rejected" || entry.tone === "error"
      ? "destructive"
      : entry.tone === "ignored"
        ? "warning"
        : "success";
  return (
    <Badge className="font-mono tabular-nums" variant={variant}>
      {entry.status}
    </Badge>
  );
}

const OPEN_KEY = "tsp-dev-panel-open";

function EventLog({ runs }: { runs: Run[] }) {
  if (runs.length === 0) {
    return (
      <p className="py-6 text-center text-muted-foreground text-sm">
        Nothing sent yet. Each event shows the webhook route's answer and what
        the handler did with it.
      </p>
    );
  }
  return (
    <ol aria-live="polite" className="grid gap-4">
      {runs.map((run) => (
        <li className="grid gap-1.5" key={run.id}>
          <p className="flex items-baseline gap-2 text-sm">
            <span className="font-semibold">{run.label}</span>
            <span className="font-mono text-subtle-foreground text-xs tabular-nums">
              {time(run.at)}
            </span>
          </p>
          {run.error ? (
            <p className="text-destructive text-sm">{run.error}</p>
          ) : null}
          <ul className="grid divide-y divide-border rounded-card bg-surface-2">
            {run.entries.map((entry) => (
              <li
                className="grid grid-cols-[3.25rem_1fr] items-center gap-x-3 gap-y-0.5 px-3 py-2 sm:grid-cols-[3.25rem_minmax(0,16rem)_1fr]"
                key={entry.id}
              >
                <StatusChip entry={entry} />
                <code className="truncate font-mono text-[13px]">
                  {entry.event}
                </code>
                <span
                  className={cn(
                    "text-sm max-sm:col-start-2",
                    entry.tone === "ok" && "text-muted-foreground",
                    entry.tone === "ignored" && "text-warning",
                    (entry.tone === "rejected" || entry.tone === "error") &&
                      "text-destructive"
                  )}
                >
                  {entry.outcome}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function Outbox({ emails, orgId }: { emails: Email[] | null; orgId: string }) {
  if (!emails) {
    return (
      <p className="py-6 text-center text-muted-foreground text-sm">Loading…</p>
    );
  }
  if (emails.length === 0) {
    return (
      <p className="py-6 text-center text-muted-foreground text-sm">
        No emails yet. Without RESEND_API_KEY every email lands here instead of
        an inbox.
      </p>
    );
  }
  return (
    <ul className="grid divide-y divide-border rounded-card bg-surface-2">
      {emails.map((email) => (
        <li
          className="grid grid-cols-[1fr_auto] items-center gap-x-3 px-3 py-2"
          key={email.id}
        >
          <div className="grid min-w-0 gap-0.5">
            <span className="truncate font-medium text-sm">
              {email.subject}
            </span>
            <span className="truncate text-muted-foreground text-xs">
              {email.to} ·{" "}
              <span className="font-mono tabular-nums">
                {time(email.sentAt)}
              </span>
            </span>
          </div>
          <a
            className="inline-flex items-center gap-1 rounded-chip px-2 py-1 font-semibold text-link text-sm hover:bg-accent"
            href={`/api/dev/orgs/${orgId}/outbox/${email.id}`}
            rel="noreferrer"
            target="_blank"
          >
            View
            <ExternalLinkIcon aria-hidden className="size-3.5" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function MonthSteps({ steps }: { steps: StepState[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {MONTH.map((step, i) => {
        const state = steps[i] ?? "pending";
        return (
          <li className="flex items-center gap-2" key={step.label}>
            {i > 0 ? <span aria-hidden className="h-px w-4 bg-border" /> : null}
            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                state === "pending" && "text-subtle-foreground",
                state === "failed" && "text-destructive"
              )}
            >
              {state === "running" ? (
                <Loader2Icon aria-hidden className="size-3.5 animate-spin" />
              ) : state === "done" ? (
                <CheckIcon aria-hidden className="size-3.5 text-success" />
              ) : state === "failed" ? (
                <XIcon aria-hidden className="size-3.5" />
              ) : (
                <span className="font-mono text-xs">{i + 1}</span>
              )}
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Developer tool on the billing page (development + local Paystack mock
 * only; the server decides). Every button asks the mock to send signed
 * webhooks to the real webhook route, then reconcile runs. Nothing here
 * writes billing state itself.
 */
export function DevBillingPanel({
  orgId,
  status,
}: {
  orgId: string;
  status: SubscriptionStatus | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | "month" | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [emails, setEmails] = useState<Email[] | null>(null);
  const [tab, setTab] = useState<"events" | "emails">("events");
  const [steps, setSteps] = useState<StepState[] | null>(null);
  const [open, setOpen] = useState(false);

  // Remembered per browser; a missing or blocked storage just starts closed.
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(OPEN_KEY) === "1");
    } catch {}
  }, []);
  function rememberOpen(next: boolean) {
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {}
  }

  const loadEmails = useCallback(async () => {
    const res = await fetch(`/api/dev/orgs/${orgId}/outbox`, {
      cache: "no-store",
    });
    if (res.ok) {
      setEmails(((await res.json()) as { emails: Email[] }).emails);
    }
  }, [orgId]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  async function simulate(action: Action, label = LABEL[action]) {
    const res = await fetch(`/api/dev/orgs/${orgId}/simulate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      log?: LogEntry[];
      status?: SubscriptionStatus | null;
      message?: string;
      error?: string;
    };
    const id = Date.now() + Math.random();
    const run: Run = {
      id,
      label,
      at: new Date().toISOString(),
      entries: (body.log ?? []).map((entry, n) => ({
        ...entry,
        id: `${id}:${n}`,
      })),
      error: res.ok ? undefined : (body.message ?? body.error ?? "Failed"),
    };
    setRuns((previous) => [run, ...previous].slice(0, 12));
    router.refresh();
    await loadEmails();
    return { ok: res.ok, body, run };
  }

  function toastFor(
    label: string,
    result: Awaited<ReturnType<typeof simulate>>
  ) {
    if (!result.ok) {
      toast.error(label, { description: result.run.error });
      return;
    }
    const last = [...result.run.entries]
      .reverse()
      .find((e) => !e.event.startsWith("reconcile"));
    const word = result.body.status ? STATUS_WORD[result.body.status] : null;
    toast[toastKindFor(result.run.entries.map((e) => e.tone))](label, {
      description: [last?.outcome, word && `now ${word.toLowerCase()}`]
        .filter(Boolean)
        .join(" · "),
    });
  }

  async function runOne(action: Action) {
    setBusy(action);
    setTab("events");
    try {
      toastFor(LABEL[action], await simulate(action));
    } catch {
      toast.error(LABEL[action], { description: "The request failed." });
    } finally {
      setBusy(null);
    }
  }

  async function runMonth() {
    setBusy("month");
    setTab("events");
    const states: StepState[] = MONTH.map(() => "pending");
    setSteps([...states]);
    try {
      for (const [i, step] of MONTH.entries()) {
        states[i] = "running";
        setSteps([...states]);
        const result = await simulate(
          step.action,
          `Month · ${i + 1}/3 · ${step.label}`
        );
        states[i] = result.ok ? "done" : "failed";
        setSteps([...states]);
        if (!result.ok) {
          toastFor(`Simulate a month stopped at ${step.label}`, result);
          return;
        }
        // Let the plan panel settle so each state is visible.
        await new Promise((r) => setTimeout(r, 1200));
      }
      toast.success("Simulated a month", {
        description: "Renewal, failed renewal and recovery, all via webhooks.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <details
      className="group/dev rounded-tile border-2 border-input/50 border-dashed"
      data-dev-tools
      onToggle={(event) => rememberOpen(event.currentTarget.open)}
      open={open}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-3 text-muted-foreground">
            <FlaskConicalIcon aria-hidden className="size-4.5" />
          </span>
          <div className="grid gap-1">
            <h2
              className="font-semibold text-lg leading-tight"
              id="dev-tools-title"
            >
              Simulate billing
            </h2>
            <p className="max-w-[60ch] text-muted-foreground text-sm">
              The mock sends signed webhooks to the real webhook route, then
              reconcile runs. Nothing here writes billing state directly.
            </p>
          </div>
        </div>
        <span className="flex items-center gap-2">
          <Badge className="font-mono" variant="outline">
            Dev tools · local mock only
          </Badge>
          <ChevronDownIcon
            aria-hidden
            className="size-4 text-muted-foreground transition-transform duration-(--dur-fast) group-open/dev:rotate-180 motion-reduce:transition-none"
          />
        </span>
      </summary>
      <div className="grid gap-5 px-5 pb-5 sm:px-6 sm:pb-6">
        {status === null ? (
          <p className="rounded-card bg-surface-2 p-3 text-muted-foreground text-sm">
            Start a plan above to simulate renewals, failures and recovery.
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ACTIONS.map(({ action, label, hint, icon: Icon }) => {
                const reason = disabledReason(action, status);
                return (
                  <Button
                    aria-busy={busy === action || undefined}
                    className="h-auto min-h-14 justify-start gap-3 whitespace-normal px-3 py-2.5 text-left"
                    disabled={busy !== null || reason !== null}
                    key={action}
                    onClick={() => runOne(action)}
                    variant="outline"
                  >
                    {busy === action ? (
                      <Loader2Icon aria-hidden className="animate-spin" />
                    ) : (
                      <Icon aria-hidden />
                    )}
                    <span className="grid gap-0.5">
                      <span className="text-sm leading-tight">{label}</span>
                      <span className="font-normal text-muted-foreground text-xs leading-tight">
                        {reason ?? hint}
                      </span>
                    </span>
                  </Button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card bg-surface-2 p-3">
              <Button
                aria-busy={busy === "month" || undefined}
                disabled={
                  busy !== null || disabledReason("renew", status) !== null
                }
                onClick={runMonth}
                size="sm"
              >
                {busy === "month" ? (
                  <Loader2Icon aria-hidden className="animate-spin" />
                ) : (
                  <CalendarRangeIcon aria-hidden />
                )}
                Simulate a month
              </Button>
              {steps ? (
                <MonthSteps steps={steps} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Renewal → failed renewal → recovery, one step at a time.
                </p>
              )}
            </div>
          </>
        )}

        <Tabs
          className="gap-3"
          onValueChange={(value) => setTab(value as "events" | "emails")}
          value={tab}
        >
          <div className="flex items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="events">
                Events
                {runs.length ? (
                  <span className="font-mono text-xs tabular-nums">
                    {runs.reduce((n, r) => n + r.entries.length, 0)}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="emails">
                <MailIcon aria-hidden />
                Emails
                {emails?.length ? (
                  <span className="font-mono text-xs tabular-nums">
                    {emails.length}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>
            {tab === "emails" ? (
              <Button
                aria-label="Refresh emails"
                onClick={() => loadEmails()}
                size="icon-sm"
                variant="ghost"
              >
                <RefreshCwIcon aria-hidden />
              </Button>
            ) : null}
          </div>
          <TabsContent value="events">
            <EventLog runs={runs} />
          </TabsContent>
          <TabsContent value="emails">
            <Outbox emails={emails} orgId={orgId} />
          </TabsContent>
        </Tabs>
      </div>
    </details>
  );
}
