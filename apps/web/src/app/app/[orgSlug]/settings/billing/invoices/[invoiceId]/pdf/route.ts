import { headers } from "next/headers";

import { getServerContext } from "@/server/context";
import { handleInvoicePdf } from "@/server/invoices";

type Params = { params: Promise<{ orgSlug: string; invoiceId: string }> };

/** The invoice as a PDF download. Same permission check as the page. */
export async function GET(_request: Request, { params }: Params) {
  const { orgSlug, invoiceId } = await params;
  return handleInvoicePdf(getServerContext(), {
    headers: await headers(),
    orgSlug,
    invoiceId,
  });
}
