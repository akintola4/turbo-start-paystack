"use client";

import type { Currency } from "@workspace/billing/money";
import { createContext, type ReactNode, useContext, useState } from "react";

export type Interval = "monthly" | "annually";

/** Where the last change came from, so the hero can ripple from that tile. */
export type CurrencyOrigin =
  | { source: "wall"; index: number }
  | { source: "other" };

type LandingState = {
  currency: Currency;
  origin: CurrencyOrigin;
  setCurrency: (code: Currency, origin?: CurrencyOrigin) => void;
  interval: Interval;
  setInterval: (interval: Interval) => void;
};

const LandingContext = createContext<LandingState | null>(null);

/**
 * One currency for the whole landing: the hero wall, the pricing switch and
 * the receipt footer all read and write it, so they never disagree.
 */
export function LandingProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("NGN");
  const [origin, setOrigin] = useState<CurrencyOrigin>({ source: "other" });
  const [interval, setInterval] = useState<Interval>("monthly");
  const setCurrency = (
    code: Currency,
    from: CurrencyOrigin = { source: "other" }
  ) => {
    setOrigin(from);
    setCurrencyState(code);
  };
  return (
    <LandingContext.Provider
      value={{ currency, origin, setCurrency, interval, setInterval }}
    >
      {children}
    </LandingContext.Provider>
  );
}

export function useLanding(): LandingState {
  const ctx = useContext(LandingContext);
  if (!ctx) {
    throw new Error("useLanding must be used inside <LandingProvider>");
  }
  return ctx;
}
