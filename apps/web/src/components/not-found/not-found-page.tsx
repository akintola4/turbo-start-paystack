"use client";

import type { Currency } from "@workspace/billing/money";
import { cn } from "@workspace/tailwind-config/utils";
import { buttonVariants } from "@workspace/ui/components/button";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { Declined } from "@/components/not-found/declined";
import { LostTile } from "@/components/not-found/lost-tile";
import { TileBoard } from "@/components/not-found/tile-board";
import { Panel, Wordmark } from "@/components/primitives";
import { fileUrl, REPO } from "@/lib/landing";
import { displayPath } from "@/lib/not-found";

const OPTIONS = {
  a: { label: "Tiles", Component: TileBoard },
  b: { label: "Declined", Component: Declined },
  c: { label: "Puzzle", Component: LostTile },
} as const;
type OptionKey = keyof typeof OPTIONS;

const isOption = (v: string | null): v is OptionKey =>
  v === "a" || v === "b" || v === "c";

/**
 * Preview only, while the three options are compared: switches with ?v=.
 * Deleted with the options that aren't picked.
 */
function Switcher({ current }: { current: OptionKey }) {
  return (
    <nav
      aria-label="Preview a 404 option"
      className="fixed right-[calc(var(--edge)+12px)] bottom-[calc(var(--edge)+12px)] z-50 flex gap-1 rounded-control bg-surface-1 p-1 shadow-tile"
      data-switcher
    >
      {(Object.keys(OPTIONS) as OptionKey[]).map((key) => (
        <Link
          aria-current={key === current ? "page" : undefined}
          className={cn(
            "pressable pressable-sm grid h-9 min-w-9 place-items-center rounded-chip px-2.5 font-semibold text-[13px]",
            key === current
              ? "bg-highlight text-highlight-foreground"
              : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          )}
          href={`?v=${key}`}
          key={key}
          replace
          scroll={false}
        >
          {key.toUpperCase()}
          <span className="sr-only"> {OPTIONS[key].label}</span>
        </Link>
      ))}
    </nav>
  );
}

function Page({ currency }: { currency: Currency }) {
  const path = usePathname() ?? "/";
  const v = useSearchParams()?.get("v") ?? null;
  const key: OptionKey = isOption(v) ? v : "a";
  const { Component } = OPTIONS[key];

  return (
    <div className="flex min-h-dvh flex-col pt-(--edge)">
      <Panel as="div" className="landing-bleed flex flex-1 flex-col p-0 sm:p-0">
        <div className="landing-inner flex flex-1 flex-col pb-(--gut)">
          <header className="flex items-center justify-between gap-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
            <Wordmark className="text-panel-foreground" />
            <a
              className={cn(
                buttonVariants(),
                "bg-panel-tile text-panel-foreground hover:bg-panel-line"
              )}
              href={REPO}
            >
              GitHub
            </a>
          </header>
          <main
            className="flex flex-1 flex-col justify-center py-[clamp(24px,5vh,64px)]"
            id="content"
          >
            <Component
              currency={currency}
              key={key}
              path={path}
              shown={displayPath(path)}
            />
          </main>
        </div>
      </Panel>
      <footer className="landing-section flex flex-wrap items-center justify-between gap-x-6 gap-y-1 pt-4 pb-20 text-[13px] text-muted-foreground">
        <p>
          Turbo Start Paystack ·{" "}
          <a
            className="pressable pressable-sm rounded-chip underline-offset-4 hover:text-foreground hover:underline"
            href={fileUrl("LICENSE")}
          >
            MIT licence
          </a>
        </p>
        <p>Not affiliated with Paystack.</p>
      </footer>
      <Switcher current={key} />
    </div>
  );
}

/** The 404, in one of three preview options (?v=a|b|c). */
export function NotFoundPage({ currency }: { currency: Currency }) {
  return (
    <Suspense>
      <Page currency={currency} />
    </Suspense>
  );
}
