import { isAuthError, roleHasPermission } from "@workspace/auth/permissions";
import type { AuthService } from "@workspace/auth/server";
import type { BillingService } from "@workspace/billing";
import { invoiceDate } from "@workspace/billing";
import { formatMoney } from "@workspace/billing/money";
import { type Database, schema } from "@workspace/db";
import { eq } from "drizzle-orm";

import {
  type PaletteItem,
  type PaletteResult,
  searchItems,
} from "@/lib/command-search";
import { formatDate } from "@/lib/format";

type SearchDeps = {
  db: Database;
  authService: AuthService;
  billing: BillingService;
};

/** Per group, so one long list can't push the others out. */
const LIMIT = 6;
const MAX_QUERY = 64;

const INVOICE_STATUS: Record<string, string> = {
  paid: "Paid",
  failed: "Failed",
  void: "Refunded",
  pending: "Pending",
};

type InvoiceRow = Awaited<ReturnType<BillingService["listInvoices"]>>[number];

/** An invoice as a palette item: its number, amount, status and date. The
 *  keywords let "10000", "10,000" and "paid" find it. */
export function invoiceItem(row: InvoiceRow, orgSlug: string): PaletteItem {
  const amount = Number(row.amountSubunit);
  const money = formatMoney(amount, row.currency).replace(/ /g, " ");
  const status = INVOICE_STATUS[row.status] ?? row.status;
  const major = Math.trunc(amount / 100);
  const href = `/app/${orgSlug}/settings/billing/invoices/${row.id}`;
  return {
    id: `invoice:${row.id}`,
    group: "Invoices",
    title: row.number ?? "Invoice",
    subtitle: `${money} · ${status} · ${formatDate(invoiceDate(row).toISOString())}`,
    keywords: [
      money,
      String(major),
      major.toLocaleString("en-GB"),
      status,
      row.description ?? "",
    ],
    href,
    altHref: `${href}/pdf`,
  };
}

const top = (items: PaletteItem[], query: string) =>
  searchItems(items, query).slice(0, LIMIT);

/**
 * GET /api/orgs/:orgId/search?q=: organizations, members and invoices for
 * the palette. The role comes from the member row of the org in the URL
 * (requirePermission); invoices need billing:view. Pages and actions are
 * static and filtered by the same role on the client.
 */
export async function handleSearch(
  deps: SearchDeps,
  input: { headers: Headers; organizationId: string; query: string }
): Promise<Response> {
  let me: Awaited<ReturnType<AuthService["requirePermission"]>>;
  try {
    me = await deps.authService.requirePermission(
      input.headers,
      input.organizationId,
      "ac:read"
    );
  } catch (error) {
    if (isAuthError(error)) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const query = input.query.trim().slice(0, MAX_QUERY);
  const canSeeBilling = roleHasPermission(me.role, "billing:view");

  const [orgs, members, invoices] = await Promise.all([
    deps.db
      .select({
        id: schema.organization.id,
        name: schema.organization.name,
        slug: schema.organization.slug,
      })
      .from(schema.member)
      .innerJoin(
        schema.organization,
        eq(schema.member.organizationId, schema.organization.id)
      )
      .where(eq(schema.member.userId, me.userId))
      .orderBy(schema.organization.name),
    query
      ? deps.db
          .select({
            id: schema.member.id,
            role: schema.member.role,
            name: schema.user.name,
            email: schema.user.email,
          })
          .from(schema.member)
          .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
          .where(eq(schema.member.organizationId, input.organizationId))
      : Promise.resolve([]),
    canSeeBilling && query
      ? deps.billing.listInvoices(input.organizationId, { limit: 200 })
      : Promise.resolve([]),
  ]);

  const current = orgs.find((o) => o.id === input.organizationId);
  const slug = current?.slug ?? "";
  const results: PaletteResult[] = [
    ...top(
      orgs.map((o) => ({
        id: `org:${o.id}`,
        group: "Organizations" as const,
        title: o.name,
        subtitle: o.id === input.organizationId ? "Current" : undefined,
        href: `/app/${o.slug}`,
      })),
      query
    ),
    ...top(
      members.map((m) => ({
        id: `member:${m.id}`,
        group: "Members" as const,
        title: m.name,
        subtitle: `${m.email} · ${m.role.charAt(0).toUpperCase()}${m.role.slice(1)}`,
        keywords: [m.email],
        href: `/app/${slug}/members#member-${m.id}`,
      })),
      query
    ),
    ...top(
      invoices.map((row) => invoiceItem(row, slug)),
      query
    ),
  ];
  return Response.json(
    { results },
    { headers: { "cache-control": "private, no-store" } }
  );
}
