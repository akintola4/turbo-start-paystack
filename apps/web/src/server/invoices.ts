import { isAuthError } from "@workspace/auth/permissions";
import { userRateLimit } from "@workspace/auth/rate-limit";
import type { AuthService } from "@workspace/auth/server";
import {
  type BillingService,
  buildInvoiceDocument,
  currentBuyer,
  type InvoiceDocument,
  invoiceFilename,
} from "@workspace/billing";
import type { Database } from "@workspace/db";

import { renderInvoicePdf } from "./invoice-pdf";

type InvoiceDeps = {
  db: Database;
  authService: AuthService;
  billing: BillingService;
};

export type ViewableInvoice = {
  org: { id: string; name: string; slug: string };
  /** The signed-in user looking at it. */
  viewerId: string;
  doc: InvoiceDocument;
  filename: string;
};

/**
 * One invoice for the signed-in viewer, or null: not signed in, not a
 * member of the organization in the URL, missing billing:view, or an
 * invoice that belongs to another organization. Callers answer 404 for all
 * of them, so invoice ids and org slugs can't be probed.
 */
export async function loadViewableInvoice(
  deps: InvoiceDeps,
  input: { headers: Headers; orgSlug: string; invoiceId: string }
): Promise<ViewableInvoice | null> {
  if (!/^[\w-]{1,64}$/.test(input.invoiceId)) {
    return null;
  }
  const membership = await deps.authService.getMembershipBySlug(
    input.headers,
    input.orgSlug
  );
  if (!membership) {
    return null;
  }
  const org = membership.organization;
  try {
    await deps.authService.requirePermission(
      input.headers,
      org.id,
      "billing:view"
    );
  } catch (error) {
    if (isAuthError(error)) {
      return null;
    }
    throw error;
  }
  const row = await deps.billing.getInvoice(org.id, input.invoiceId);
  if (!row) {
    return null;
  }
  const doc = buildInvoiceDocument(row, {
    config: deps.billing.invoicing(),
    buyer: await currentBuyer(deps.db, org.id),
  });
  return {
    org: { id: org.id, name: org.name, slug: org.slug },
    viewerId: membership.session.user.id,
    doc,
    filename: invoiceFilename(doc, org.slug),
  };
}

/** GET …/invoices/[invoiceId]/pdf: the invoice as a PDF download. */
export async function handleInvoicePdf(
  deps: InvoiceDeps,
  input: { headers: Headers; orgSlug: string; invoiceId: string }
): Promise<Response> {
  const invoice = await loadViewableInvoice(deps, input);
  if (!invoice) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const limited = await userRateLimit(deps.db, invoice.viewerId, "invoicePdf");
  if (limited) {
    return limited;
  }
  const pdf = await renderInvoicePdf(invoice.doc);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(pdf.byteLength),
      // The filename is built from [A-Za-z0-9-] only, so it needs no
      // escaping; filename* is there for clients that prefer it.
      "content-disposition": `attachment; filename="${invoice.filename}"; filename*=UTF-8''${invoice.filename}`,
      // Tax documents with names and addresses: never in a shared cache.
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
