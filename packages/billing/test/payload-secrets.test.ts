import { createHash } from "node:crypto";
import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { decryptSecret } from "../src/crypto";
import { invoiceEvent } from "../src/fixtures";
import { redactStoredPayloads } from "../src/redact-stored";
import {
  hasPlainSecrets,
  REDACTED,
  redactSecrets,
  sealSecrets,
  unsealSecrets,
} from "../src/webhook/redact";
import { type BillingHarness, KEY, setupBilling } from "./support";

let h: BillingHarness;
beforeAll(async () => {
  h = await setupBilling();
});
afterAll(async () => h.close());

describe("secrets in stored payloads (audit #3)", () => {
  it("keeps authorization codes and email tokens out of webhook_event.payload and invoice.raw", async () => {
    const { organizationId, paid, sub } = await h.subscribe("pro-monthly-ngn");
    const remote = h.fake.subscriptions.get(sub.paystackSubscriptionCode ?? "");
    const authorizationCode = paid.charge.data.authorization.authorization_code;
    const emailToken = remote?.email_token ?? "";
    expect(authorizationCode).toMatch(/^AUTH_/);
    expect(emailToken).not.toBe("");

    await h.deliver(
      invoiceEvent({
        event: "invoice.update",
        invoiceCode: `INV_secret_${organizationId}`,
        subscriptionCode: sub.paystackSubscriptionCode ?? "",
        amount: 3_000_000,
        status: "success",
        paid: true,
        customer: paid.customer,
        periodStart: "2026-04-01T10:00:00.000Z",
        periodEnd: "2026-05-01T10:00:00.000Z",
        reference: `renew_secret_${organizationId}`,
      })
    );

    const events = await h.db.select().from(schema.webhookEvent);
    expect(events.length).toBeGreaterThanOrEqual(3);
    for (const event of events) {
      const stored = JSON.stringify(event.payload);
      expect(stored).not.toContain(authorizationCode);
      expect(stored).not.toContain(emailToken);
      expect(hasPlainSecrets(event.payload)).toBe(false);
      // Processing still sees the real values.
      expect(event.error).toBeNull();
    }

    const invoices = await h.db
      .select()
      .from(schema.invoice)
      .where(eq(schema.invoice.organizationId, organizationId));
    const withRaw = invoices.filter((i) => i.raw !== null);
    expect(withRaw.length).toBeGreaterThan(0);
    for (const invoice of withRaw) {
      const raw = JSON.stringify(invoice.raw);
      expect(raw).not.toContain(authorizationCode);
      expect(raw).toContain(`"authorization_code":"${REDACTED}"`);
      // The rest is kept for debugging.
      expect(raw).toContain(`INV_secret_${organizationId}`);
    }

    // The encrypted columns still hold the real values.
    const [row] = await h.db
      .select()
      .from(schema.subscription)
      .where(eq(schema.subscription.id, sub.id));
    expect(decryptSecret(row?.authorizationCode ?? "", KEY)).toBe(
      authorizationCode
    );
    expect(decryptSecret(row?.paystackEmailToken ?? "", KEY)).toBe(emailToken);
  });

  it("dedupes on the raw body even though sealing is randomised", async () => {
    const { paid } = await h.subscribe("starter-monthly-ngn");
    const raw = JSON.stringify(paid.charge);
    const [event] = await h.db
      .select()
      .from(schema.webhookEvent)
      .where(
        eq(
          schema.webhookEvent.dedupeKey,
          createHash("sha256").update(raw).digest("hex")
        )
      );
    expect(event).toBeDefined();
    const again = await h.deliver(paid.charge);
    expect(again?.id).toBe(event?.id);
  });

  it("cleans rows stored before sealing, and is safe to re-run", async () => {
    const { organizationId } = await h.createOrg();
    const legacy = {
      event: "subscription.create",
      data: {
        subscription_code: "SUB_legacy",
        email_token: "tok_legacy",
        authorization: { authorization_code: "AUTH_legacy" },
      },
    };
    await h.db.insert(schema.webhookEvent).values({
      id: "evt_legacy",
      eventType: legacy.event,
      dedupeKey: "legacy-key",
      payload: legacy,
    });
    await h.db.insert(schema.invoice).values({
      id: "inv_legacy",
      organizationId,
      subscriptionId: null,
      amountSubunit: 100,
      currency: "NGN",
      status: "pending",
      raw: legacy.data,
    });

    const report = await redactStoredPayloads(h.db, KEY, 2);
    expect(report).toEqual({ webhookEvents: 1, invoices: 1 });

    const [event] = await h.db
      .select()
      .from(schema.webhookEvent)
      .where(eq(schema.webhookEvent.id, "evt_legacy"));
    expect(JSON.stringify(event?.payload)).not.toMatch(
      /tok_legacy|AUTH_legacy/
    );
    expect(unsealSecrets(event?.payload, KEY)).toEqual(legacy);
    expect(event?.dedupeKey).toBe("legacy-key");
    const [invoice] = await h.db
      .select()
      .from(schema.invoice)
      .where(eq(schema.invoice.id, "inv_legacy"));
    expect(invoice?.raw).toEqual({
      subscription_code: "SUB_legacy",
      email_token: REDACTED,
      authorization: { authorization_code: REDACTED },
    });

    expect(await redactStoredPayloads(h.db, KEY)).toEqual({
      webhookEvents: 0,
      invoices: 0,
    });
  });

  it("seals, unseals and redacts nested secrets only", () => {
    const payload = {
      event: "subscription.create",
      data: {
        email_token: "tok_1",
        subscription_code: "SUB_1",
        authorization: { authorization_code: "AUTH_1", last4: "4081" },
        history: [{ access_code: "acc_1" }],
      },
    };
    const sealed = sealSecrets(payload, KEY);
    expect(JSON.stringify(sealed)).not.toMatch(/tok_1|AUTH_1|acc_1/);
    expect(sealed.data.subscription_code).toBe("SUB_1");
    expect(sealed.data.authorization.last4).toBe("4081");
    expect(sealSecrets(sealed, KEY)).toEqual(sealed);
    expect(unsealSecrets(sealed, KEY)).toEqual(payload);
    expect(redactSecrets(payload).data).toMatchObject({
      email_token: REDACTED,
      subscription_code: "SUB_1",
      authorization: { authorization_code: REDACTED, last4: "4081" },
      history: [{ access_code: REDACTED }],
    });
    expect(hasPlainSecrets(payload)).toBe(true);
    expect(hasPlainSecrets(sealed)).toBe(false);
  });
});
