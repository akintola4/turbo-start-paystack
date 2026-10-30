import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { InvoiceActions } from "@/components/billing/invoice-actions";
import { InvoicePaper } from "@/components/billing/invoice-paper";
import { invoiceView } from "@/lib/invoice-view";
import { getServerContext } from "@/server/context";
import { loadViewableInvoice } from "@/server/invoices";

type Props = { params: Promise<{ orgSlug: string; invoiceId: string }> };

/** Members without billing access, other orgs' invoices and unknown ids
 *  all 404, checked on the server for the org in the URL. */
const load = cache(async (orgSlug: string, invoiceId: string) => {
  const invoice = await loadViewableInvoice(getServerContext(), {
    headers: await headers(),
    orgSlug,
    invoiceId,
  });
  if (!invoice) {
    notFound();
  }
  return invoice;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orgSlug, invoiceId } = await params;
  const { doc } = await load(orgSlug, invoiceId);
  return { title: doc.number ?? doc.title };
}

export default async function InvoicePage({ params }: Props) {
  const { orgSlug, invoiceId } = await params;
  const invoice = await load(orgSlug, invoiceId);
  const billingHref = `/app/${orgSlug}/settings/billing#invoices`;
  return (
    <div className="grid w-full max-w-[860px] animate-content gap-6">
      <div
        className="flex flex-wrap items-center justify-between gap-3"
        data-print="hide"
      >
        <Link
          className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-control px-2 font-medium text-muted-foreground transition-colors duration-(--dur-fast) hover:text-foreground"
          href={billingHref}
        >
          <ArrowLeftIcon aria-hidden className="size-4" />
          Billing
        </Link>
        <InvoiceActions
          filename={invoice.filename}
          pdfHref={`/app/${orgSlug}/settings/billing/invoices/${invoice.doc.id}/pdf`}
        />
      </div>
      <InvoicePaper view={invoiceView(invoice.doc)} />
    </div>
  );
}
