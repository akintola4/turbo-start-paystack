import { Skeleton } from "@workspace/ui/components/skeleton";
import { Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";

import { Mark } from "@/components/primitives";

/** The page title and its one-line description, at the real sizes. */
function HeaderSkeleton() {
  return (
    <div className="grid gap-2">
      <Skeleton className="h-9 w-56 rounded-chip sm:h-11 sm:w-64" />
      <Skeleton className="h-6 w-72 max-w-full rounded-chip" />
    </div>
  );
}

/**
 * Route skeletons. Each matches its page's geometry in the common state
 * (an active plan), so the content replaces it without a jump.
 */
function Loading({ children }: { children: ReactNode }) {
  return (
    <div aria-busy="true" className="grid gap-8" role="status">
      <span className="sr-only">Loading</span>
      <HeaderSkeleton />
      {children}
    </div>
  );
}

export function DashboardLoading() {
  return (
    <Loading>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[175px] rounded-panel lg:col-span-2 lg:h-[207px]" />
        <Skeleton className="h-[179px] rounded-tile lg:h-[207px]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[203px] rounded-tile lg:h-[311px]" />
        <Skeleton className="h-[364px] rounded-tile lg:col-span-2 lg:h-[311px]" />
      </div>
    </Loading>
  );
}

export function MembersLoading() {
  return (
    <Loading>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[340px] rounded-tile lg:col-span-2 lg:h-[186px]" />
        <Skeleton className="h-[169px] rounded-tile lg:h-[186px]" />
      </div>
      <Skeleton className="h-[320px] rounded-tile" />
    </Loading>
  );
}

export function BillingLoading() {
  return (
    <div aria-busy="true" className="grid gap-10 sm:gap-12" role="status">
      <span className="sr-only">Loading billing</span>
      <HeaderSkeleton />
      <Skeleton className="h-[426px] rounded-panel sm:h-[260px]" />
      <div className="grid gap-5">
        <Skeleton className="h-[52px] w-full max-w-md rounded-chip" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-[331px] rounded-tile" />
          <Skeleton className="hidden h-[331px] rounded-tile md:block" />
          <Skeleton className="hidden h-[331px] rounded-tile md:block" />
        </div>
      </div>
    </div>
  );
}

export function ConfirmingPayment() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div
        className="grid max-w-sm animate-content justify-items-center gap-5 text-center [animation-delay:400ms]"
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
          <h1 className="font-semibold text-2xl tracking-[-0.02em]">
            Confirming your payment
          </h1>
          <p className="text-muted-foreground">
            We're checking with Paystack before we change anything. This usually
            takes a second or two.
          </p>
        </div>
        <span
          aria-hidden
          className="relative h-1 w-40 overflow-hidden rounded-full bg-muted"
        >
          <span className="absolute inset-y-0 left-0 w-1/3 animate-indeterminate rounded-full bg-primary" />
        </span>
      </div>
    </main>
  );
}

/** Settings column: one tile per section, at the owner's heights. */
function SettingsColumn({ heights }: { heights: string[] }) {
  return (
    <div className="grid max-w-3xl gap-6">
      {heights.map((h) => (
        <Skeleton className={`rounded-tile ${h}`} key={h} />
      ))}
    </div>
  );
}

export function OrgSettingsLoading() {
  return (
    <Loading>
      <SettingsColumn
        heights={[
          "h-[476px] sm:h-[378px]",
          "h-[375px] sm:h-[275px]",
          "h-[248px] sm:h-[188px]",
          "h-[423px] sm:h-[295px]",
        ]}
      />
    </Loading>
  );
}

export function AccountLoading() {
  return (
    <Loading>
      <SettingsColumn
        heights={[
          "h-[362px] sm:h-[350px]",
          "h-[354px] sm:h-[342px]",
          "h-[384px] sm:h-[286px]",
          "h-[592px] sm:h-[552px]",
          "h-[176px] sm:h-[164px]",
          "h-[308px] sm:h-[208px]",
        ]}
      />
    </Loading>
  );
}
