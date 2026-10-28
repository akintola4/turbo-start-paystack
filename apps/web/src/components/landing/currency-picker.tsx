"use client";

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group";
import { cn } from "@workspace/tailwind-config/utils";
import { CheckIcon } from "lucide-react";
import { useState } from "react";

import { HighlightChip, Money } from "@/components/primitives";

export type CurrencyPlan = {
  key: string;
  name: string;
  description: string;
  monthly: string | null;
  trialDays: number;
  features: string[];
};

export type CurrencyTable = {
  code: string;
  glyph: string;
  name: string;
  plans: CurrencyPlan[];
}[];

export function CurrencyPicker({ table }: { table: CurrencyTable }) {
  const [code, setCode] = useState(table[0]?.code ?? "NGN");
  const current = table.find((t) => t.code === code) ?? table[0];
  if (!current) {
    return null;
  }
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium text-sm" id="currency-label">
          Price your plans in
        </p>
        <ToggleGroup
          aria-labelledby="currency-label"
          className="w-full rounded-full bg-muted p-1 sm:w-auto"
          onValueChange={(v) => v[0] && setCode(v[0])}
          value={[code]}
        >
          {table.map((t) => (
            <ToggleGroupItem
              aria-label={`${t.name} (${t.code})`}
              className="h-9 flex-1 rounded-full px-4 font-semibold text-muted-foreground text-sm first:rounded-full last:rounded-full data-[pressed]:bg-background data-[pressed]:text-foreground data-[pressed]:shadow-tile sm:flex-none"
              key={t.code}
              value={t.code}
            >
              <span className="font-display">{t.glyph}</span>
              <span className="hidden font-normal text-xs sm:inline">
                {t.code}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {current.plans.map((plan) => (
          <li
            className={cn(
              "relative grid content-start gap-5 rounded-[20px] border bg-card p-6 shadow-tile",
              plan.key === "pro" && "border-primary/40 ring-1 ring-primary/30"
            )}
            key={plan.key}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-semibold text-lg">
                {plan.name}
              </h3>
              {plan.trialDays > 0 ? (
                <HighlightChip>{plan.trialDays}-day trial</HighlightChip>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              {plan.monthly ? (
                <Money
                  key={`${code}-${plan.key}`}
                  label={plan.monthly}
                  per="month"
                />
              ) : (
                <span className="font-display font-semibold text-[32px] leading-none tracking-tight">
                  Free
                </span>
              )}
              <p className="text-muted-foreground text-sm">
                {plan.description}
              </p>
            </div>
            <ul className="grid gap-2 border-t pt-5 text-sm">
              {plan.features.map((f) => (
                <li className="flex items-center gap-2" key={f}>
                  <CheckIcon aria-hidden className="size-4 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
