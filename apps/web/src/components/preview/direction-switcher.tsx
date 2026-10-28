"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTransition } from "react";

import type { DirectionId } from "@/directions/types";

const OPTIONS: { id: DirectionId; label: string; name: string }[] = [
  { id: "a", label: "A", name: "Ledger" },
  { id: "b", label: "B", name: "Console" },
  { id: "c", label: "C", name: "Market" },
];

/**
 * Throwaway preview control for the redesign. Sets the `tsp-direction`
 * cookie and re-renders the current page. "Current" opens the same path on
 * the untouched app at :3100.
 */
export function DirectionSwitcher({ current }: { current: DirectionId }) {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [pending, start] = useTransition();

  return (
    <div
      className="-translate-x-1/2 fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[60] flex items-center gap-1 rounded-full border border-black/10 bg-white/90 p-1 font-[system-ui] text-[13px] text-neutral-900 shadow-[0_8px_30px_rgb(0_0_0/0.12)] backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/90 dark:text-neutral-100"
      data-pending={pending || undefined}
      data-preview-switcher
      role="toolbar"
      aria-label="Design direction preview"
    >
      {OPTIONS.map((o) => (
        <button
          aria-pressed={current === o.id}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full px-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500",
            current === o.id
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "hover:bg-black/5 dark:hover:bg-white/10"
          )}
          key={o.id}
          onClick={() => {
            document.cookie = `tsp-direction=${o.id}; path=/; max-age=31536000; samesite=lax`;
            start(() => router.refresh());
          }}
          type="button"
        >
          <span className="font-semibold">{o.label}</span>
          <span className="hidden sm:inline">{o.name}</span>
        </button>
      ))}
      <span
        aria-hidden
        className="mx-1 h-4 w-px bg-black/10 dark:bg-white/15"
      />
      <a
        className="flex h-8 items-center rounded-full px-3 outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-white/10"
        href={`http://localhost:3100${pathname}`}
        rel="noreferrer"
        target="_blank"
      >
        Current
      </a>
      <button
        aria-label="Toggle dark mode"
        className="flex size-8 items-center justify-center rounded-full outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-white/10"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        type="button"
      >
        <span aria-hidden>◐</span>
      </button>
    </div>
  );
}
