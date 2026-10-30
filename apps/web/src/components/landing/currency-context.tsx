"use client";

import type { Currency } from "@workspace/billing/money";
import { createContext, type ReactNode, useContext, useState } from "react";

export type Interval = "monthly" | "annually";

/** Where the last change came from, so the hero can ripple from that tile. */
export type CurrencyOrigin =
  | { source: "wall"; index: number }
  | { source: "other" };

type LandingState = {
  /** The chosen currency: pricing, demos, the receipt and the footer. */
  currency: Currency;
  /** What the hero shows: a hovered tile's currency, else the chosen one. */
  shown: Currency;
  origin: CurrencyOrigin;
  setCurrency: (code: Currency, origin?: CurrencyOrigin) => void;
  /** Hover preview on the wall. Never saved; `null` ends it. */
  preview: (code: Currency | null, origin?: CurrencyOrigin) => void;
  interval: Interval;
  setInterval: (interval: Interval) => void;
};

const LandingContext = createContext<LandingState | null>(null);

/** Cookie that remembers the visitor's currency; read by the page on the
 *  server so the first paint is already in that currency. */
export const CURRENCY_COOKIE = "tsp-currency";

/**
 * One currency for the whole landing. The hero wall is its only control:
 * pointing at a tile previews it in the hero, and a click, tap or arrow key
 * commits it (and only then is it remembered).
 */
export function LandingProvider({
  children,
  initialCurrency = "NGN",
  initialInterval = "monthly",
}: {
  children: ReactNode;
  initialCurrency?: Currency;
  initialInterval?: Interval;
}) {
  const [currency, setCurrencyState] = useState<Currency>(initialCurrency);
  const [previewed, setPreviewed] = useState<Currency | null>(null);
  const [origin, setOrigin] = useState<CurrencyOrigin>({ source: "other" });
  const [interval, setInterval] = useState<Interval>(initialInterval);
  const setCurrency = (
    code: Currency,
    from: CurrencyOrigin = { source: "other" }
  ) => {
    setOrigin(from);
    setPreviewed(null);
    setCurrencyState(code);
    // biome-ignore lint/suspicious/noDocumentCookie: a plain preference cookie; the Cookie Store API is not in Safari.
    document.cookie = `${CURRENCY_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
  };
  const preview = (
    code: Currency | null,
    from: CurrencyOrigin = { source: "other" }
  ) => {
    if (code) {
      setOrigin(from);
    }
    setPreviewed(code);
  };
  return (
    <LandingContext.Provider
      value={{
        currency,
        shown: previewed ?? currency,
        origin,
        setCurrency,
        preview,
        interval,
        setInterval,
      }}
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
