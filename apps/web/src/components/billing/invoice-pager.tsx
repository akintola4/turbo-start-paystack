"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { buttonVariants } from "@workspace/ui/components/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { BillingData } from "@/lib/view-models";

/**
 * Newer / Older. The page change runs in a transition, so the current list
 * stays on screen (dimmed) until the next page arrives instead of the whole
 * route falling back to its loading skeleton.
 */
export function InvoicePager({ page }: { page: BillingData["invoicePage"] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const control = (href: string | null, label: string, next: boolean) => {
    const Icon = next ? ChevronRightIcon : ChevronLeftIcon;
    const content = (
      <>
        {next ? null : <Icon aria-hidden />}
        {label}
        {next ? <Icon aria-hidden /> : null}
      </>
    );
    const className = buttonVariants({ variant: "outline", size: "sm" });
    if (!href) {
      return (
        <span aria-disabled className={cn(className, "opacity-50")}>
          {content}
        </span>
      );
    }
    return (
      <Link
        className={className}
        href={href}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey) {
            return;
          }
          event.preventDefault();
          startTransition(() => router.push(href, { scroll: false }));
        }}
        rel={next ? "next" : "prev"}
      >
        {content}
      </Link>
    );
  };

  return (
    <nav
      aria-busy={pending || undefined}
      aria-label="Invoice pages"
      className="flex flex-wrap items-center justify-between gap-3 px-1"
      data-pending={pending || undefined}
    >
      <p className="text-muted-foreground text-sm tabular-nums">
        {page.from}–{page.to} of {page.total}
      </p>
      <div className="flex gap-2">
        {control(page.prevHref, "Newer", false)}
        {control(page.nextHref, "Older", true)}
      </div>
    </nav>
  );
}
