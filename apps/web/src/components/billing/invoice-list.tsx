import { cn } from "@workspace/tailwind-config/utils";
import { buttonVariants } from "@workspace/ui/components/button";
import {
  ChevronRightIcon,
  DownloadIcon,
  ReceiptTextIcon,
  RotateCwIcon,
} from "lucide-react";
import Link from "next/link";

import { BillingAction } from "@/components/billing/billing-action";
import { InvoicePager } from "@/components/billing/invoice-pager";
import { Amount, InvoiceBadge, Tile } from "@/components/primitives";
import { formatDate } from "@/lib/format";
import { spokenMoney } from "@/lib/money";
import type { BillingData, InvoiceRow } from "@/lib/view-models";

/** Date · invoice · amount · status · actions. Shared by header and rows so
 *  the columns line up to the pixel. Switched on the list's own width (48rem),
 *  not the viewport's, so the invoice column never collapses beside a sidebar. */
const COLUMNS =
  "@3xl:grid-cols-[7.5rem_minmax(0,1fr)_8.5rem_7rem_5.75rem] @3xl:gap-x-4";

/**
 * The whole row opens the invoice (a stretched link). In a narrow list it is two
 * lines (invoice and amount, then date and status) with the row action
 * beside them, so Retry and Download never disappear.
 */
function Row({ inv, data }: { inv: InvoiceRow; data: BillingData }) {
  const label = inv.number ?? inv.description;
  return (
    <li
      className={cn(
        "group relative grid min-h-14 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 border-border border-t py-3 pr-3 pl-5 transition-colors duration-(--dur-fast) first:border-t-0 hover:bg-surface-2 @3xl:px-6",
        COLUMNS
      )}
    >
      <span className="whitespace-nowrap text-muted-foreground text-sm tabular-nums @max-3xl:col-start-1 @max-3xl:row-start-2">
        {/* Paid rows show the paid date; unpaid ones the date they fell due. */}
        {inv.status === "failed" || inv.status === "pending" ? "Due " : null}
        {formatDate(inv.date)}
      </span>
      <span className="grid min-w-0 gap-0.5 @max-3xl:col-start-1 @max-3xl:row-start-1">
        <Link
          className="truncate font-medium outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:outline-ring focus-visible:after:-outline-offset-2 group-last:after:rounded-b-tile"
          href={inv.href}
        >
          {inv.description}
          <span className="sr-only">
            , {spokenMoney(inv.amountLabel)}, {formatDate(inv.date)}
          </span>
        </Link>
        {inv.number || inv.period ? (
          <span className="truncate text-muted-foreground text-sm @max-3xl:hidden">
            {inv.number ? (
              <span className="tabular-nums">{inv.number}</span>
            ) : null}
            {inv.number && inv.period ? <span aria-hidden>{" · "}</span> : null}
            {inv.period ? (
              <span className="whitespace-nowrap">{inv.period}</span>
            ) : null}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "text-right @max-3xl:col-start-2 @max-3xl:row-start-1",
          inv.status === "void" && "text-muted-foreground line-through"
        )}
      >
        <Amount label={inv.amountLabel} />
      </span>
      <span className="flex @max-3xl:col-start-2 @max-3xl:row-start-2 @max-3xl:justify-end">
        <InvoiceBadge status={inv.status} />
      </span>
      <span className="flex items-center justify-end gap-1 @max-3xl:col-start-3 @max-3xl:row-span-2 @max-3xl:row-start-1">
        {/* Only the control sits above the stretched link; "View" stays
            under it, so a click there opens the invoice. */}
        {inv.status === "failed" && data.canManage ? (
          <BillingAction
            action="manage-card"
            aria-label="Retry with another card"
            className="z-10"
            orgId={data.org.id}
            size="icon-sm"
            variant="ghost"
          >
            <RotateCwIcon aria-hidden />
          </BillingAction>
        ) : (
          <a
            aria-label={`Download ${label} as PDF`}
            className={buttonVariants({
              variant: "ghost",
              size: "icon-sm",
              className: "z-10",
            })}
            download
            href={inv.pdfHref}
          >
            <DownloadIcon aria-hidden />
          </a>
        )}
        <span
          aria-hidden
          className="pointer-events-none flex h-9 items-center gap-0.5 pr-1 pl-1.5 font-medium text-muted-foreground text-sm transition-colors duration-(--dur-fast) group-hover:text-foreground @max-3xl:hidden"
        >
          View
          <ChevronRightIcon className="size-4" />
        </span>
      </span>
    </li>
  );
}

/** Refunded trial card checks: money that came straight back, so they are
 *  not invoices. Listed apart, closed by default. */
function CardChecks({ data }: { data: BillingData }) {
  if (data.cardChecks.length === 0) {
    return null;
  }
  return (
    <details className="group/checks rounded-tile px-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-medium text-muted-foreground text-sm transition-colors duration-(--dur-fast) hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          aria-hidden
          className="size-4 transition-transform duration-(--dur-fast) group-open/checks:rotate-90 motion-reduce:transition-none"
        />
        Card checks ({data.cardChecks.length})
      </summary>
      <div className="grid gap-3 pt-1 pb-2 pl-6">
        <p className="max-w-[60ch] text-muted-foreground text-sm">
          The small charge that saved the card for a trial. It was refunded
          straight away, so it isn't an invoice.
        </p>
        <ul className="grid gap-1">
          {data.cardChecks.map((check) => (
            <li
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
              key={check.id}
            >
              <span className="w-28 text-muted-foreground tabular-nums">
                {formatDate(check.date)}
              </span>
              <span className="text-muted-foreground line-through">
                <Amount label={check.amountLabel} />
              </span>
              <InvoiceBadge status="void" />
              <span className="text-muted-foreground">
                {check.refundedAt ? `on ${formatDate(check.refundedAt)}` : null}
              </span>
              <Link
                className="inline-flex min-h-11 items-center font-medium text-link underline-offset-4 hover:underline"
                href={check.href}
              >
                View receipt
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export function InvoiceList({ data }: { data: BillingData }) {
  return (
    <section
      aria-labelledby="invoices-title"
      className="grid scroll-mt-20 gap-4"
      id="invoices"
    >
      <h2 className="font-semibold text-xl" id="invoices-title">
        Invoices
      </h2>
      {data.invoices.length === 0 ? (
        <Tile className="flex min-h-32 items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-card bg-surface-2 text-muted-foreground">
            <ReceiptTextIcon aria-hidden className="size-5" />
          </span>
          <div className="grid gap-1">
            <p className="font-semibold">No invoices yet</p>
            <p className="text-muted-foreground">
              Every payment adds an invoice here, numbered, to view, print or
              download as a PDF.
            </p>
          </div>
        </Tile>
      ) : (
        <Tile className="overflow-hidden @container p-0 transition-opacity duration-(--dur-fast) sm:p-0 [section:has([data-pending])>&]:opacity-60">
          <div
            aria-hidden
            className={cn(
              "hidden border-border border-b px-6 py-2.5 font-medium text-[12px] text-muted-foreground uppercase tracking-[0.06em] @3xl:grid",
              COLUMNS
            )}
          >
            <span>Date</span>
            <span>Invoice</span>
            <span className="text-right">Amount</span>
            <span>Status</span>
            <span />
          </div>
          <ul>
            {data.invoices.map((inv) => (
              <Row data={data} inv={inv} key={inv.id} />
            ))}
          </ul>
        </Tile>
      )}
      <InvoicePager page={data.invoicePage} />
      <CardChecks data={data} />
    </section>
  );
}
