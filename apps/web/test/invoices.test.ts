import { writeFileSync } from "node:fs";
import { createAuth } from "@workspace/auth/server";
import {
  createBillingService,
  createPaystackClient,
  listPlanPrices,
} from "@workspace/billing";
import { createFakePaystack } from "@workspace/billing/fake";
import { schema } from "@workspace/db";
import { createTestDb } from "@workspace/db/testing";
import { createMailer } from "@workspace/email";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { handleBillingAction } from "../src/server/billing-routes";
import { handleInvoicePdf, loadViewableInvoice } from "../src/server/invoices";

const SELLER = {
  name: "Turbo Start Ltd",
  address: "12 Admiralty Way\nLekki, Lagos",
  email: "billing@turbo.test",
  taxId: "RC 1234567",
  vatNumber: "12345678-0001",
};

let ctx: Awaited<ReturnType<typeof setup>>;

async function setup() {
  const { db, close } = await createTestDb();
  const fake = createFakePaystack();
  const billing = createBillingService({
    db,
    paystack: createPaystackClient({
      secretKey: "sk_test_invoices",
      baseUrl: "http://paystack.fake",
      fetch: (input, init) => fake.handle(new Request(input, init)),
    }),
    encryptionKey: "d".repeat(64),
    callbackUrl: "http://localhost:3000/billing/callback",
    graceDays: 7,
    trialMode: "off",
    invoicing: { seller: SELLER, taxRateBp: 750 },
    logger: { info() {}, warn() {}, error() {} },
  });
  const authService = createAuth({
    db,
    secret: "invoices-test-secret-invoices-test-secret",
    baseURL: "http://localhost:3000",
    mailer: createMailer({
      appUrl: "http://localhost:3000",
      send: async () => undefined,
    }),
  });
  for (const price of listPlanPrices()) {
    await db
      .insert(schema.planPrice)
      .values({ ...price, paystackPlanCode: `PLN_${price.id}` });
    fake.addPlan({
      plan_code: `PLN_${price.id}`,
      name: price.id,
      amount: price.amountSubunit,
      interval: price.interval,
      currency: price.currency,
    });
  }
  return { db, close, fake, billing, authService };
}

async function signUp(email: string) {
  const { auth } = ctx.authService;
  await auth.api.signUpEmail({
    body: { email, password: "correct-horse-battery", name: email },
  });
  const res = await auth.api.signInEmail({
    body: { email, password: "correct-horse-battery" },
    asResponse: true,
  });
  return new Headers({
    cookie: res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  });
}

async function addMember(orgId: string, email: string, role: string) {
  const headers = await signUp(email);
  const [user] = await ctx.db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email));
  await ctx.db.insert(schema.member).values({
    id: `m_${email}`,
    organizationId: orgId,
    userId: user?.id ?? "",
    role,
  });
  return headers;
}

/** Pays a checkout through the fake and confirms it the way the callback
 *  page does. Returns the invoice id. */
async function paidInvoice(orgId: string, email: string) {
  const [user] = await ctx.db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email));
  const checkout = await ctx.billing.startCheckout({
    organizationId: orgId,
    actor: { userId: user?.id ?? "", email },
    planPriceId: "pro-monthly-ngn",
  });
  ctx.fake.pay(checkout.reference);
  await ctx.billing.confirmByReference(orgId, checkout.reference);
  const [row] = await ctx.billing.listInvoices(orgId);
  if (!row) {
    throw new Error("no invoice");
  }
  return row.id;
}

const roles: Record<string, Headers> = {};
let invoiceId: string;
let otherInvoiceId: string;

beforeAll(async () => {
  ctx = await setup();
  roles.owner = await signUp("ada@kola.test");
  const org = await ctx.authService.auth.api.createOrganization({
    headers: roles.owner,
    body: { name: "Kola Logistics", slug: "kola-logistics" },
  });
  const orgId = org?.id ?? "";
  for (const role of ["admin", "billing", "member", "viewer"]) {
    roles[role] = await addMember(orgId, `${role}@kola.test`, role);
  }
  roles.outsider = await signUp("eve@globex.test");
  const other = await ctx.authService.auth.api.createOrganization({
    headers: roles.outsider,
    body: { name: "Globex", slug: "globex" },
  });
  invoiceId = await paidInvoice(orgId, "ada@kola.test");
  otherInvoiceId = await paidInvoice(other?.id ?? "", "eve@globex.test");
});
afterAll(async () => ctx.close());

const view = (headers: Headers, id = invoiceId, orgSlug = "kola-logistics") =>
  loadViewableInvoice(ctx, { headers, orgSlug, invoiceId: id });
const pdf = (headers: Headers, id = invoiceId, orgSlug = "kola-logistics") =>
  handleInvoicePdf(ctx, { headers, orgSlug, invoiceId: id });

describe("invoice view and PDF: who can see them", () => {
  it.each([
    ["owner", true],
    ["admin", true],
    ["billing", true],
    ["member", false],
    ["viewer", false],
    ["outsider", false],
  ])("%s → %s", async (role, allowed) => {
    const headers = roles[role] ?? new Headers();
    expect(Boolean(await view(headers))).toBe(allowed);
    expect((await pdf(headers)).status).toBe(allowed ? 200 : 404);
  });

  it("404s without a session", async () => {
    expect(await view(new Headers())).toBeNull();
    expect((await pdf(new Headers())).status).toBe(404);
  });

  it("404s for another organization's invoice, even for an owner", async () => {
    const owner = roles.owner ?? new Headers();
    expect(await view(owner, otherInvoiceId)).toBeNull();
    expect((await pdf(owner, otherInvoiceId)).status).toBe(404);
    // …and through the other org's slug, where the owner isn't a member.
    expect(await view(owner, otherInvoiceId, "globex")).toBeNull();
    expect(await view(owner, "../../etc")).toBeNull();
  });
});

describe("invoice PDF", () => {
  it("is a real A4 PDF with the invoice's filename, embedding Geist and the ₦ fallback", async () => {
    const res = await pdf(roles.billing ?? new Headers());
    const invoice = await view(roles.billing ?? new Headers());
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(invoice?.doc.number).toMatch(/^INV-2026-\d{6}$/);
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="${invoice?.doc.number}-kola-logistics.pdf"; filename*=UTF-8''${invoice?.doc.number}-kola-logistics.pdf`
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const text = bytes.toString("latin1");
    expect(text).toMatch(/\/MediaBox \[0 0 595\.2\d* 841\.8\d*\]/);
    expect(text).toMatch(/\/BaseFont \/[A-Z]{6}\+Geist-SemiBold/);
    expect(text).toMatch(/\/BaseFont \/[A-Z]{6}\+GeistMono-Regular/);
    // The currency subset (Inter) is embedded only if ₦ was drawn with it.
    expect(text).toMatch(/\/BaseFont \/[A-Z]{6}\+CurrencySymbols-/);
    if (process.env.INVOICE_PDF_OUT) {
      writeFileSync(process.env.INVOICE_PDF_OUT, bytes);
    }
  });

  it("shows VAT from the snapshot: net + VAT = total", async () => {
    const invoice = await view(roles.owner ?? new Headers());
    expect(invoice?.doc.totals).toMatchObject({
      netSubunit: 2_790_698,
      taxSubunit: 209_302,
      totalSubunit: 3_000_000,
      taxRateBp: 750,
    });
    expect(invoice?.doc.seller).toEqual(SELLER);
    expect(invoice?.doc.buyer.name).toBe("Kola Logistics");
  });
});

describe("billing details route", () => {
  const orgIdOf = async () =>
    (await view(roles.owner ?? new Headers()))?.org.id ?? "";

  const details = {
    legalName: "Kola Logistics Limited",
    address: "3 Marina\nLagos",
    taxId: "TIN 1234",
    email: "accounts@kola.test",
  };

  it("lets billing managers save, and refuses admins and members", async () => {
    const orgId = await orgIdOf();
    const call = (role: string) =>
      handleBillingAction(ctx, {
        headers: roles[role] ?? new Headers(),
        organizationId: orgId,
        action: "billing-details",
        body: details,
        contentType: "application/json",
      });
    expect((await call("member")).status).toBe(403);
    expect((await call("admin")).status).toBe(403);
    const res = await call("billing");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(details);
  });

  it("rejects unknown fields, bad emails and over-long values", async () => {
    const billing = roles.billing ?? new Headers();
    const orgId = await orgIdOf();
    const call = (body: unknown) =>
      handleBillingAction(ctx, {
        headers: billing,
        organizationId: orgId,
        action: "billing-details",
        body,
        contentType: "application/json",
      });
    expect((await call({ ...details, amount: 1 })).status).toBe(400);
    expect((await call({ ...details, email: "not-an-email" })).status).toBe(
      400
    );
    expect(
      (await call({ ...details, legalName: "x".repeat(201) })).status
    ).toBe(400);
    expect((await call({ ...details, email: "" })).status).toBe(200);
  });

  it("does not change the issued invoice", async () => {
    const invoice = await view(roles.owner ?? new Headers());
    expect(invoice?.doc.buyer).toEqual({
      name: "Kola Logistics",
      address: null,
      taxId: null,
      email: "ada@kola.test",
    });
  });
});
