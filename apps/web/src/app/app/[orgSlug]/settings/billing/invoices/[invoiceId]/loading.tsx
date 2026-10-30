import { Skeleton } from "@workspace/ui/components/skeleton";

/** Same geometry as the invoice page, so nothing moves when it arrives. */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      className="grid w-full max-w-[860px] gap-6"
      role="status"
    >
      <span className="sr-only">Loading invoice</span>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="-ml-2 h-11 w-24 rounded-control" />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-24 rounded-control" />
          <Skeleton className="h-11 w-40 rounded-control" />
        </div>
      </div>
      <div className="grid gap-8 rounded-tile bg-card p-5 shadow-tile sm:gap-10 sm:p-10">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48 rounded-chip" />
          <Skeleton className="h-10 w-40 rounded-chip" />
        </div>
        <Skeleton className="h-[440px] rounded-card sm:h-[362px] lg:h-[316px]" />
        <div className="grid gap-6 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-card" />
          <Skeleton className="h-28 rounded-card" />
        </div>
        <Skeleton className="h-40 rounded-card" />
      </div>
    </div>
  );
}
