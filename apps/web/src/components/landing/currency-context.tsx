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

/** Cookie that remembers the visitor's currency; read by the page on the
 *  server so the first paint is already in that currency. */
export const CURRENCY_COOKIE = "tsp-currency";

/**
 * One currency for the whole landing: the hero wall, pricing, the receipt
 * and the footer all read and write it, so they never disagree.
 */
export function LandingProvider({
  children,
  initialCurrency = "NGN",
}: {
  children: ReactNode;
  initialCurrency?: Currency;
}) {
  const [currency, setCurrencyState] = useState<Currency>(initialCurrency);
  const [origin, setOrigin] = useState<CurrencyOrigin>({ source: "other" });
  const [interval, setInterval] = useState<Interval>("monthly");
  const setCurrency = (
    code: Currency,
    from: CurrencyOrigin = { source: "other" }
  ) => {
    setOrigin(from);
    setCurrencyState(code);
    // biome-ignore lint/suspicious/noDocumentCookie: a plain preference cookie; the Cookie Store API is not in Safari.
    document.cookie = `${CURRENCY_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
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
