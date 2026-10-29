"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { ArrowUpRightIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { type ProviderStatus, parseProviderStatus } from "@/lib/landing";

const STATUS_PAGE = "https://status.paystack.com";
const SUMMARY_URL = `${STATUS_PAGE}/api/v2/summary.json`;

const LABEL: Record<ProviderStatus, string> = {
  normal: "All systems normal",
  degraded: "Degraded",
  outage: "Outage",
  maintenance: "Maintenance",
};

const DOT: Record<ProviderStatus, string> = {
  normal: "bg-success",
  degraded: "bg-warning",
  outage: "bg-destructive",
  maintenance: "bg-info",
};

type State =
  | { kind: "loading" }
  | { kind: "known"; status: ProviderStatus; incident?: string }
  | { kind: "unknown" };

/**
 * Paystack's live status, read in the browser from its public status API
 * (CORS is open). Until it answers, or if it can't be read, this is a plain
 * "Check Paystack status" link with no dot: we never show a colour we didn't
 * get from Paystack.
 */
export function PaystackStatus({ className }: { className?: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    fetch(SUMMARY_URL, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const status = parseProviderStatus(json?.page?.status);
        const incident = json?.activeIncidents?.[0]?.name;
        setState(
          status
            ? {
                kind: "known",
                status,
                incident: typeof incident === "string" ? incident : undefined,
              }
            : { kind: "unknown" }
        );
      })
      .catch(() => setState({ kind: "unknown" }))
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const known = state.kind === "known" ? state : null;
  return (
    <a
      className={cn(
        "group inline-flex h-8 items-center gap-2 rounded-chip bg-panel-tile px-2.5 text-[13px] text-panel-foreground transition-colors duration-(--dur-fast) hover:bg-panel-line",
        className
      )}
      data-status={known?.status ?? state.kind}
      href={STATUS_PAGE}
      rel="noopener"
      target="_blank"
      title={known?.incident}
    >
      {known ? (
        <span aria-hidden className="relative grid size-2 place-items-center">
          <span
            className={cn(
              "absolute inset-0 rounded-full opacity-60 motion-safe:animate-status-pulse",
              DOT[known.status]
            )}
          />
          <span className={cn("size-2 rounded-full", DOT[known.status])} />
        </span>
      ) : null}
      <span className="[text-box:trim-both_cap_alphabetic]">
        {known ? (
          <>
            Paystack status
            <span className="text-panel-muted"> · {LABEL[known.status]}</span>
          </>
        ) : (
          "Check Paystack status"
        )}
      </span>
      <ArrowUpRightIcon
        aria-hidden
        className="size-3.5 text-panel-muted transition-transform duration-(--dur-fast) group-hover:translate-x-px group-hover:-translate-y-px"
      />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
