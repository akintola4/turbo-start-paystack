import type { BillingNotification } from "@workspace/billing";
import { schema } from "@workspace/db";
import { createTestDb } from "@workspace/db/testing";
import { createMailer, type EmailMessage } from "@workspace/email";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { notifyBillingAdmins } from "../src/server/billing-emails";

let ctx: Awaited<ReturnType<typeof setup>>;

async function setup() {
  const { db, close } = await createTestDb();
  await db.insert(schema.organization).values({
    id: "org_1",
    name: "Acme <Logistics>",
    slug: "acme",
  });
  const people = [
    ["owner", "owner@acme.test"],
    ["billing", "billing@acme.test"],
    ["admin", "admin@acme.test"],
    ["member", "member@acme.test"],
  ] as const;
  for (const [role, email] of people) {
    await db.insert(schema.user).values({ id: role, name: role, email });
    await db.insert(schema.member).values({
      id: `m_${role}`,
      organizationId: "org_1",
      userId: role,
      role,
    });
  }
  const outbox: EmailMessage[] = [];
  const mailer = createMailer({
    appUrl: "https://app.test",
    send: async (m) => {
      outbox.push(m);
    },
  });
  return { db, close, outbox, mailer };
}

beforeAll(async () => {
  ctx = await setup();
});
afterAll(async () => ctx.close());

async function send(n: BillingNotification) {
  ctx.outbox.length = 0;
  await notifyBillingAdmins({ db: ctx.db, mailer: ctx.mailer }, n);
  return [...ctx.outbox];
}

const base = { organizationId: "org_1" };

describe("notifyBillingAdmins", () => {
  it("emails only members who can manage billing, html and text", async () => {
    const sent = await send({
      ...base,
      type: "payment_succeeded",
      key: "receipt:tsp_1",
      planPriceId: "pro-monthly-ghs",
      amountSubunit: 45_000,
      currency: "GHS",
      reference: "tsp_1",
      invoiceId: "inv_1",
      paidAt: new Date("2026-10-28T00:00:00Z"),
      periodStart: new Date("2026-10-28T00:00:00Z"),
      periodEnd: new Date("2026-11-28T00:00:00Z"),
    });
    expect(sent.map((m) => m.to).sort()).toEqual([
      "billing@acme.test",
      "owner@acme.test",
    ]);
    const [mail] = sent;
    expect(mail?.subject).toBe("Receipt for GH₵450.00: Acme <Logistics>");
    expect(mail?.html).toContain("Acme &lt;Logistics&gt;");
    expect(mail?.text).toContain("Plan: Pro (monthly)");
    expect(mail?.text).toContain(
      "https://app.test/app/acme/settings/billing/invoices/inv_1"
    );
    expect(mail?.text).toContain("View invoice");
    expect(mail?.idempotencyKey).toMatch(/^[0-9a-f]{64}$/);
    expect(sent[0]?.idempotencyKey).not.toBe(sent[1]?.idempotencyKey);
  });

  it.each<[BillingNotification, RegExp]>([
    [
      {
        ...base,
        type: "past_due",
        key: "k1",
        planPriceId: "pro-monthly-ngn",
        graceUntil: new Date("2026-11-04T00:00:00Z"),
        manageLink: "https://paystack.com/manage/subscriptions/x",
      },
      /Payment failed/,
    ],
    [
      {
        ...base,
        type: "trial_ending",
        key: "k2",
        planPriceId: "starter-monthly-ngn",
        trialEndsAt: new Date("2026-10-31T00:00:00Z"),
        amountSubunit: 1_000_000,
        currency: "NGN",
      },
      /Starter trial .* ends on 31 October 2026/,
    ],
    [
      {
        ...base,
        type: "subscription_canceled",
        key: "k3",
        planPriceId: "pro-annually-usd",
        accessUntil: new Date("2027-01-01T00:00:00Z"),
      },
      /Pro plan .* won't renew/,
    ],
    [
      {
        ...base,
        type: "plan_changed",
        key: "k4",
        change: "upgrade",
        fromPlanPriceId: "starter-annually-zar",
        toPlanPriceId: "pro-annually-zar",
        chargedSubunit: 180_000,
        currency: "ZAR",
        effectiveAt: new Date("2026-10-28T00:00:00Z"),
      },
      /is now on Pro \(yearly\)/,
    ],
    [
      {
        ...base,
        type: "trial_started",
        key: "k5",
        planPriceId: "starter-monthly-kes",
        trialEndsAt: new Date("2026-11-11T00:00:00Z"),
      },
      /Starter trial .* has started/,
    ],
    [{ ...base, type: "expiring_card", key: "k6" }, /card .* expires soon/],
    [
      { ...base, type: "dispute", key: "k7", reference: "tsp_9" },
      /was disputed/,
    ],
    [
      {
        ...base,
        type: "refund_failed",
        key: "k8",
        reference: "tsp-10",
        refundStatus: "failed",
        amountSubunit: 5000,
        currency: "NGN",
      },
      /refund .* didn't go through/,
    ],
  ])("%#: renders the %s template", async (notification, subject) => {
    const sent = await send(notification);
    expect(sent).toHaveLength(2);
    expect(sent[0]?.subject).toMatch(subject);
    expect(sent[0]?.html).toContain("<html");
    expect(sent[0]?.text.length).toBeGreaterThan(50);
  });

  it("keeps Paystack's manage link and drops anything else", async () => {
    const failed = (manageLink: string): BillingNotification => ({
      ...base,
      type: "past_due",
      key: "k",
      planPriceId: "pro-monthly-ngn",
      graceUntil: new Date("2026-11-04T00:00:00Z"),
      manageLink,
    });
    const [ok] = await send(failed("https://paystack.com/manage/x"));
    expect(ok?.text).toContain("https://paystack.com/manage/x");
    const [bad] = await send(failed("https://evil.test/manage"));
    expect(bad?.text).not.toContain("evil.test");
  });

  it("does nothing for an organization that no longer exists", async () => {
    const sent = await send({
      ...base,
      organizationId: "gone",
      type: "dispute",
      key: "k",
      reference: "r",
    });
    expect(sent).toHaveLength(0);
  });
});
