"use client";

import { TableRow } from "@workspace/ui/components/table";
import { cn } from "@workspace/tailwind-config/utils";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Re-mounts its children when `value` changes and plays a short settle-in.
 * The first render never animates, so nothing moves on page load.
 */
export function SwapOnChange({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const previous = useRef(value);
  const changed = useRef(false);
  if (previous.current !== value) {
    previous.current = value;
    changed.current = true;
  }
  return (
    <span
      className={cn(
        "inline-flex",
        changed.current && "animate-swap",
        className
      )}
      key={value}
    >
      {children}
    </span>
  );
}

/**
 * Price and currency changes: the old value leaves upward while the new one
 * arrives from below, stacked in one grid cell so the wider string holds the
 * width (no layout shift). First render is static.
 */
export function NumberSwap({
  value,
  render,
  delayMs = 0,
  className,
}: {
  value: string;
  render: (value: string) => ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const [leaving, setLeaving] = useState<string | null>(null);
  const changed = useRef(false);
  if (shown !== value) {
    changed.current = true;
    setLeaving(shown);
    setShown(value);
  }
  useEffect(() => {
    if (leaving === null) {
      return;
    }
    const t = window.setTimeout(() => setLeaving(null), 140 + delayMs);
    return () => window.clearTimeout(t);
  }, [leaving, delayMs]);
  const delay = { animationDelay: `${delayMs}ms` };
  return (
    <span className={cn("inline-grid [&>*]:[grid-area:1/1]", className)}>
      {leaving !== null ? (
        <span
          aria-hidden
          className="animate-number-out"
          key={`out-${leaving}`}
          style={delay}
        >
          {render(leaving)}
        </span>
      ) : null}
      <span
        className={changed.current ? "animate-number-in" : undefined}
        key={`in-${shown}`}
        style={changed.current ? delay : undefined}
      >
        {render(shown)}
      </span>
    </span>
  );
}

type RowPresence = {
  leaving: ReadonlySet<string>;
  markLeaving: (id: string) => void;
  unmark: (id: string) => void;
};

const RowPresenceContext = createContext<RowPresence | null>(null);

/**
 * Lets a row fade out the moment its removal is confirmed (the server
 * round-trip happens underneath), and lets rows that arrive after the first
 * render settle in. Rows read `useRowPresence(id)` into `data-presence`.
 */
export function RowPresenceProvider({
  ids,
  children,
}: {
  ids: string[];
  children: ReactNode;
}) {
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  const initial = useRef<ReadonlySet<string>>(new Set(ids));
  const value = useMemo<RowPresence & { initial: ReadonlySet<string> }>(
    () => ({
      leaving,
      initial: initial.current,
      markLeaving: (id) => setLeaving((s) => new Set(s).add(id)),
      unmark: (id) =>
        setLeaving((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        }),
    }),
    [leaving]
  );
  return (
    <RowPresenceContext.Provider value={value}>
      {children}
    </RowPresenceContext.Provider>
  );
}

export function useRowPresenceActions() {
  return useContext(RowPresenceContext);
}

/** "entering" for rows added after first paint, "leaving" while removing. */
export function useRowPresence(id: string): "entering" | "leaving" | undefined {
  const ctx = useContext(RowPresenceContext) as
    | (RowPresence & { initial: ReadonlySet<string> })
    | null;
  if (!ctx) {
    return undefined;
  }
  if (ctx.leaving.has(id)) {
    return "leaving";
  }
  return ctx.initial.has(id) ? undefined : "entering";
}

/** Table row wired to the row presence above, with a quiet hover. */
export function PresenceTableRow({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const presence = useRowPresence(id);
  return (
    <TableRow
      className={cn("transition-colors duration-(--duration-hover)", className)}
      data-presence={presence}
    >
      {children}
    </TableRow>
  );
}
