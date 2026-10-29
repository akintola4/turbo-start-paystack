import { buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/tailwind-config/utils";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  ReceiptTextIcon,
  RotateCwIcon,
} from "lucide-react";
import Link from "next/link";

import { BillingAction } from "@/components/billing/billing-action";
import { Amount, InvoiceBadge, Tile } from "@/components/primitives";
import { formatDate } from "@/lib/format";
import type { BillingData, InvoiceRow } from "@/lib/view-models";

/** Date · invoice · amount · status · actions. Shared by header and rows so
 *  the columns line up to the pixel. */
const COLUMNS =
  "sm:grid-cols-[7.5rem_minmax(0,1fr)_8.5rem_7rem_5.75rem] sm:gap-x-4";

function Row({ inv, data }: { inv: InvoiceRow; data: BillingData }) {
  const label = inv.number ?? inv.description;
  return (
    <li
      className={cn(
        "group relative grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-border border-t px-5 py-3 transition-colors duration-(--dur-fast) first:border-t-0 hover:bg-surface-2 sm:px-6",
        COLUMNS
      )}
    >
      <span className="whitespace-nowrap text-muted-foreground text-sm tabular-nums max-sm:order-3">
        {/* Paid rows show the paid date; unpaid ones the date they fell due. */}
        {inv.status === "failed" || inv.status === "pending" ? "Due " : null}
        {formatDate(inv.date)}
      </span>
      <span className="grid min-w-0 gap-0.5 max-sm:order-1">
        <Link
          className="truncate font-medium outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:outline-2 focus-visible:after:outline-ring focus-visible:after:-outline-offset-2"
          href={inv.href}
        >
          {inv.description}
          <span className="sr-only">
            , {inv.amountLabel}, {formatDate(inv.date)}
          </span>
        </Link>
        {inv.number || inv.period ? (
          <span className="flex flex-wrap gap-x-1.5 text-muted-foreground text-sm sm:block sm:truncate">
            {inv.number ? (
              <span className="tabular-nums">{inv.number}</span>
            ) : null}
            {inv.number && inv.period ? (
              <span aria-hidden className="max-sm:hidden">
                {" · "}
              </span>
            ) : null}
            {inv.period ? (
              <span className="whitespace-nowrap">{inv.period}</span>
            ) : null}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "text-right max-sm:order-2",
          inv.status === "void" && "text-muted-foreground line-through"
        )}
      >
        <Amount label={inv.amountLabel} />
      </span>
      <span className="flex max-sm:order-4 max-sm:justify-end">
        <InvoiceBadge status={inv.status} />
      </span>
      {/* Above the row's stretched link, so each control keeps its own click. */}
      <span className="relative z-10 hidden items-center justify-end gap-1 sm:flex">
        {inv.status === "failed" && data.canManage ? (
          <BillingAction
            action="manage-card"
            aria-label="Retry with another card"
            orgId={data.org.id}
            size="icon-sm"
            variant="ghost"
          >
            <RotateCwIcon aria-hidden />
          </BillingAction>
        ) : (
          <a
            aria-label={`Download ${label} as PDF`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            download
            href={inv.pdfHref}
          >
            <DownloadIcon aria-hidden />
          </a>
        )}
        <span
          aria-hidden
          className="flex h-9 items-center gap-0.5 pr-1 pl-1.5 font-medium text-muted-foreground text-sm transition-colors duration-(--dur-fast) group-hover:text-foreground"
        >
          View
          <ChevronRightIcon className="size-4" />
        </span>
      </span>
    </li>
  );
}

function Pagination({ page }: { page: BillingData["invoicePage"] }) {
  if (page.pageCount <= 1) {
    return null;
  }
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
    return href ? (
      <Link className={className} href={href} rel={next ? "next" : "prev"}>
        {content}
      </Link>
    ) : (
      <span aria-disabled className={cn(className, "opacity-50")}>
        {content}
      </span>
    );
  };
  return (
    <nav
      aria-label="Invoice pages"
      className="flex flex-wrap items-center justify-between gap-3 px-1"
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
          className="size-4 transition-transform duration-(--dur-fast) group-open/checks:rotate-90"
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
                className="inline-flex min-h-9 items-center font-medium text-link underline-offset-4 hover:underline"
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
        <Tile className="overflow-hidden p-0 sm:p-0">
          <div
            aria-hidden
            className={cn(
              "hidden border-border border-b px-6 py-2.5 font-medium text-[12px] text-subtle-foreground uppercase tracking-[0.06em] sm:grid",
              COLUMNS
            )}
          >
            <span>Paid on</span>
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
      <Pagination page={data.invoicePage} />
      <CardChecks data={data} />
    </section>
  );
}
