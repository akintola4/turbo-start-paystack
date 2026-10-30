import { cn } from "@workspace/tailwind-config/utils";

import {
  Amount,
  InvoiceBadge,
  Money,
  Panel,
  Tile,
} from "@/components/primitives";
import type { InvoiceView } from "@/lib/invoice-view";
import { spokenMoney } from "@/lib/money";

/** The document's status as the list's badge status. */
const BADGE_STATUS = {
  paid: "paid",
  refunded: "void",
  failed: "failed",
  pending: "pending",
} as const;

function Party({
  id,
  label,
  party,
}: {
  id: string;
  label: string;
  party: InvoiceView["from"];
}) {
  return (
    <section aria-labelledby={id} className="grid content-start gap-1">
      <h2
        className="font-medium text-[12px] text-muted-foreground uppercase tracking-[0.06em]"
        id={id}
      >
        {label}
      </h2>
      <p className="font-semibold text-[15px]">{party.name}</p>
      {party.lines.length > 0 ? (
        <address className="grid text-muted-foreground text-sm not-italic leading-[1.6]">
          {party.lines.map((line) => (
            <span className="break-words" key={line}>
              {line}
            </span>
          ))}
        </address>
      ) : null}
    </section>
  );
}

/**
 * The invoice as a page: the same content and order as the PDF
 * (`server/invoice-pdf.tsx`), both rendered from one `InvoiceView`. Prints
 * on light paper in either theme (see the print rules in globals.css).
 */
export function InvoicePaper({ view }: { view: InvoiceView }) {
  return (
    <Tile
      aria-labelledby="invoice-title"
      as="article"
      className="invoice-paper grid gap-8 p-5 sm:gap-10 sm:p-10"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 select-none items-center justify-center rounded-chip bg-panel font-semibold text-[13px] text-panel-foreground"
          >
            {view.mark}
          </span>
          <span className="min-w-0 font-semibold text-[17px] leading-tight">
            {view.from.name}
          </span>
        </div>
        <div className="grid shrink-0 gap-0.5 sm:justify-items-end sm:text-right">
          <h1
            className="font-normal text-muted-foreground text-sm"
            id="invoice-title"
          >
            {view.title}
            {view.number ? (
              <span className="sr-only"> {view.number}</span>
            ) : null}
          </h1>
          {view.number ? (
            <span
              aria-hidden
              className="font-semibold text-[17px] tabular-nums tracking-[-0.01em]"
            >
              {view.number}
            </span>
          ) : null}
        </div>
      </header>

      {/* Inside a 24px tile, so the panel steps down to 16 rather than 32. */}
      <Panel as="section" className="grid gap-6 rounded-card">
        <InvoiceBadge className="w-fit" status={BADGE_STATUS[view.status]} />
        <div className="grid gap-3">
          {view.struck ? (
            <span
              className="font-money font-semibold text-[40px] text-panel-muted leading-none tracking-[-0.02em] line-through decoration-2 sm:text-[56px]"
              data-money
            >
              <span aria-hidden>{view.heroAmount}</span>
              <span className="sr-only">
                Refunded: {spokenMoney(view.amount)}
              </span>
            </span>
          ) : (
            <Money label={view.amount} size="xl" />
          )}
          <p className="text-panel-muted">{view.caption}</p>
        </div>
        {view.meta.length > 0 ? (
          <dl
            className={cn(
              "grid gap-3",
              view.meta.length === 3 && "sm:grid-cols-3",
              view.meta.length === 2 && "sm:grid-cols-2"
            )}
          >
            {view.meta.map((m) => (
              <div
                className="grid gap-1 rounded-card bg-panel-tile px-4 py-3"
                key={m.label}
              >
                <dt className="font-medium text-[13px] text-panel-muted">
                  {m.label}
                </dt>
                <dd className="font-semibold text-[15px] tabular-nums">
                  {m.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Panel>

      <div className="grid gap-6 sm:grid-cols-2">
        <Party id="invoice-from" label="From" party={view.from} />
        <Party id="invoice-to" label="Billed to" party={view.to} />
      </div>

      <section aria-label="Line items" className="grid">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-border border-b">
              <th
                className="pb-2.5 font-medium text-[12px] text-muted-foreground uppercase tracking-[0.06em]"
                scope="col"
              >
                Description
              </th>
              <th
                className="whitespace-nowrap pb-2.5 text-right font-medium text-[12px] text-muted-foreground uppercase tracking-[0.06em]"
                scope="col"
              >
                Amount ({view.currency})
              </th>
            </tr>
          </thead>
          <tbody>
            {view.lines.map((line) => (
              <tr className="border-border border-b" key={line.description}>
                <td className="py-3.5 pr-4 align-top">
                  <span className="block font-medium">{line.description}</span>
                  {line.detail ? (
                    <span className="block text-muted-foreground text-sm">
                      {line.detail}
                    </span>
                  ) : null}
                </td>
                <td className="py-3.5 text-right align-top">
                  <Amount label={line.amount} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-3 grid w-full gap-2 justify-self-end sm:w-[22rem]">
          {view.totals.map((t) => (
            <div
              className={cn(
                "flex items-baseline justify-between gap-4",
                t.strong && "mt-1 border-foreground border-t pt-3"
              )}
              key={t.label}
            >
              <dt
                className={cn(
                  t.strong
                    ? "font-semibold text-[17px]"
                    : "text-muted-foreground"
                )}
              >
                {t.label}
              </dt>
              <dd className={cn(t.strong && "text-[17px]")}>
                <Amount
                  className={cn(t.strong && "font-semibold")}
                  label={t.value}
                />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {view.reference ? (
        <footer className="grid gap-1.5 rounded-card bg-surface-2 px-4 py-3.5 text-sm">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-muted-foreground">Paystack reference</span>
            <span className="break-all font-mono text-[13px]">
              {view.reference}
            </span>
          </p>
          {view.paystackInvoiceCode ? (
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-muted-foreground">Paystack invoice</span>
              <span className="font-mono text-[13px]">
                {view.paystackInvoiceCode}
              </span>
            </p>
          ) : null}
          <p className="text-muted-foreground">{view.referenceNote}</p>
        </footer>
      ) : null}
    </Tile>
  );
}
