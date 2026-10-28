import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";

import { Mark } from "@/components/primitives";

export function PageLoading() {
  return (
    <div aria-busy="true" className="grid gap-8" role="status">
      <span className="sr-only">Loading</span>
      <div className="grid gap-3">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-5 w-96 max-w-full rounded-lg" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-44 rounded-[20px] md:col-span-2" />
        <Skeleton className="h-44 rounded-[20px]" />
      </div>
      <Skeleton className="h-72 rounded-[20px]" />
    </div>
  );
}

export function ConfirmingPayment() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--c-canvas)] px-4">
      <div
        className="grid max-w-sm justify-items-center gap-5 text-center"
        role="status"
      >
        <span className="relative">
          <Mark className="size-12" />
          <Loader2Icon
            aria-hidden
            className="-right-2 -bottom-2 absolute size-6 animate-spin rounded-full bg-background p-1 text-primary"
          />
        </span>
        <div className="grid gap-2">
          <h1 className="font-display font-semibold text-2xl tracking-tight">
            Confirming your payment
          </h1>
          <p className="text-muted-foreground">
            We're checking with Paystack before we change anything. This usually
            takes a second or two.
          </p>
        </div>
      </div>
    </main>
  );
}

export function NotFound() {
  return (
    <main className="flex min-h-[70dvh] items-center justify-center px-4 py-16">
      <div className="grid max-w-md justify-items-start gap-6">
        <span className="font-display font-semibold text-[88px] text-primary leading-none tracking-tighter">
          404
        </span>
        <div className="grid gap-2">
          <h1 className="font-display font-semibold text-2xl tracking-tight">
            This page isn't here
          </h1>
          <p className="text-muted-foreground">
            The link may be old, or the organization belongs to a team you're
            not part of.
          </p>
        </div>
        <Link
          className={buttonVariants({ className: "rounded-full px-5" })}
          href="/app"
        >
          Go to your organizations
        </Link>
      </div>
    </main>
  );
}
