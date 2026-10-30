import { describe, expect, it } from "vitest";

import { UnsafeLinkError } from "./links";
import { createMailer, idempotencyKey } from "./mailer";
import type { EmailMessage } from "./transport";

function setup(paystackOrigins?: string[]) {
  const sent: EmailMessage[] = [];
  const mailer = createMailer({
    send: async (m) => {
      sent.push(m);
    },
    appUrl: "https://app.test/",
    theme: { productName: "Acme Cloud" },
    paystackOrigins,
  });
  return { sent, mailer };
}

const billing = {
  organizationName: "Acme",
  organizationSlug: "acme",
};

describe("createMailer", () => {
  it("sends html and text together", async () => {
    const { sent, mailer } = setup();
    await mailer.verifyEmail({
      to: "a@x.test",
      name: "Ada",
      url: "https://app.test/api/auth/verify-email?token=t",
    });
    const [message] = sent;
    expect(message?.html).toContain("<html");
    expect(message?.text).toContain(
      "https://app.test/api/auth/verify-email?token=t"
    );
    expect(message?.subject).toBe("Confirm your email address");
    expect(message?.idempotencyKey).toBeUndefined();
  });

  it("refuses verification links that are not on the app origin", async () => {
    const { sent, mailer } = setup();
    await expect(
      mailer.verifyEmail({ to: "a@x.test", url: "https://evil.test/verify" })
    ).rejects.toBeInstanceOf(UnsafeLinkError);
    await expect(
      mailer.resetPassword({ to: "a@x.test", url: "javascript:alert(1)" })
    ).rejects.toBeInstanceOf(UnsafeLinkError);
    expect(sent).toHaveLength(0);
  });

  it("builds the invite link from the app URL and encodes the id", async () => {
    const { sent, mailer } = setup();
    await mailer.organizationInvitation({
      to: "b@x.test",
      invitationId: "inv/../../admin?x=1",
      inviterName: "Ada",
      inviterEmail: "a@x.test",
      organizationName: "Acme",
      role: "member",
      expiresInDays: 7,
    });
    expect(sent[0]?.text).toContain(
      "https://app.test/accept-invite/inv%2F..%2F..%2Fadmin%3Fx%3D1"
    );
    expect(sent[0]?.text).toContain("only works for b@x.test");
  });

  it("billing emails link to the org's billing page with an encoded slug", async () => {
    const { sent, mailer } = setup();
    await mailer.subscriptionCanceled({
      to: "b@x.test",
      key: "canceled:sub_1:2026-10-28",
      organizationName: "Acme",
      organizationSlug: "acme corp",
      planName: "Pro",
      accessUntil: new Date("2026-11-28T00:00:00Z"),
    });
    expect(sent[0]?.text).toContain(
      "https://app.test/app/acme%20corp/settings/billing"
    );
  });

  it("derives a per-recipient idempotency key from the event key", async () => {
    const { sent, mailer } = setup();
    const input = {
      ...billing,
      key: "receipt:tsp_1",
      planName: "Pro",
      interval: "monthly",
      amountSubunit: 3_000_000,
      currency: "NGN",
      reference: "tsp_1",
      invoiceId: "inv/1",
      paidAt: new Date("2026-10-28T00:00:00Z"),
    };
    await mailer.paymentReceipt({ ...input, to: "a@x.test" });
    // The receipt links to its invoice; the id is one encoded segment.
    expect(sent[0]?.text).toContain(
      "https://app.test/app/acme/settings/billing/invoices/inv%2F1"
    );
    await mailer.paymentReceipt({ ...input, to: "b@x.test" });
    await mailer.paymentReceipt({ ...input, to: "A@x.test" });
    const [a, b, aAgain] = sent.map((m) => m.idempotencyKey);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(aAgain).toBe(a);
    expect(a).toBe(idempotencyKey("receipt:tsp_1", "a@x.test"));
  });

  it("uses Paystack's manage link only when it is on a Paystack host", async () => {
    const { sent, mailer } = setup(["http://localhost:4010"]);
    const base = {
      ...billing,
      to: "a@x.test",
      planName: "Pro",
      graceUntil: new Date("2026-11-04T00:00:00Z"),
    };
    await mailer.paymentFailed({
      ...base,
      manageLink: "https://paystack.com/manage/subscriptions/abc",
    });
    await mailer.paymentFailed({
      ...base,
      manageLink: "https://evil.test/paystack.com",
    });
    await mailer.paymentFailed({
      ...base,
      manageLink: "http://paystack.com/insecure",
    });
    await mailer.paymentFailed({
      ...base,
      manageLink: "http://localhost:4010/manage/abc",
    });
    await mailer.paymentFailed(base);
    const links = sent.map((m) => m.html?.match(/href="([^"]+)"/)?.[1]);
    expect(links).toEqual([
      "https://paystack.com/manage/subscriptions/abc",
      "https://app.test/app/acme/settings/billing",
      "https://app.test/app/acme/settings/billing",
      "http://localhost:4010/manage/abc",
      "https://app.test/app/acme/settings/billing",
    ]);
  });

  it("applies the product name from the theme", async () => {
    const { sent, mailer } = setup();
    await mailer.trialStarted({
      ...billing,
      to: "a@x.test",
      planName: "Starter",
      trialEndsAt: new Date("2026-11-11T00:00:00Z"),
    });
    expect(sent[0]?.text).toContain("Acme Cloud");
  });
});
