"use client";

import { useEffect, useRef } from "react";

/**
 * What the auth form tells the decorative panel. In-memory and same-page
 * only: the email never leaves this module, and nothing is logged.
 */
export type MarkSignal =
  | { type: "input"; field: "email" | "name"; value: string }
  | { type: "submit" }
  | { type: "error"; field: "email" | "password" | "confirm" | null }
  | { type: "clear" }
  | { type: "success" }
  | { type: "reset" };

type Listener = (signal: MarkSignal) => void;

const listeners = new Set<Listener>();
/** The latest values, for a panel that subscribes after typing started
 *  (autofill before hydration). Cleared when the form unmounts. */
const latest = { email: "", name: "" };

function emit(signal: MarkSignal) {
  if (signal.type === "input") {
    latest[signal.field] = signal.value;
  }
  for (const listener of listeners) {
    // The panel is decoration: if it throws, the form keeps working.
    try {
      listener(signal);
    } catch {
      // Ignored on purpose; see above.
    }
  }
}

/** For AuthForm: a stable emitter. */
export function useMarkSignals() {
  useEffect(
    () => () => {
      latest.email = "";
      latest.name = "";
    },
    []
  );
  return emit;
}

/** For the panel: subscribe for the component's lifetime. The listener
 *  may change between renders without resubscribing. */
export function useMarkListener(
  listener: (signal: MarkSignal, values: typeof latest) => void
) {
  const ref = useRef(listener);
  ref.current = listener;
  useEffect(() => {
    const fn: Listener = (signal) => ref.current(signal, latest);
    listeners.add(fn);
    if (latest.email || latest.name) {
      fn({ type: "input", field: "email", value: latest.email });
    }
    return () => {
      listeners.delete(fn);
    };
  }, []);
}
