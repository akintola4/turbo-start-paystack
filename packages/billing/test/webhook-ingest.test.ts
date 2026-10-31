import type { Database } from "@workspace/db";
import { schema } from "@workspace/db";
import { createTestDb } from "@workspace/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ingestWebhook } from "../src/webhook/ingest";
import {
  isPaystackIp,
  signPaystackPayload,
  verifyPaystackSignature,
} from "../src/webhook/verify";

const SECRET = "sk_test_webhook_secret";
const KEY = "ab".repeat(32);
const body = JSON.stringify({
  event: "charge.success",
  data: { reference: "r1" },
});

let db: Database;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => close());

describe("verifyPaystackSignature (PLAN §2.3 #13)", () => {
  const good = signPaystackPayload(body, SECRET);

  it("accepts the HMAC-SHA512 of the raw body", () => {
    expect(verifyPaystackSignature(body, good, SECRET)).toBe(true);
  });

  it("rejects a single flipped character", () => {
    const flipped = (good[0] === "a" ? "b" : "a") + good.slice(1);
    expect(verifyPaystackSignature(body, flipped, SECRET)).toBe(false);
  });

  it("rejects a re-serialised body (signature is over raw bytes)", () => {
    const reformatted = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifyPaystackSignature(reformatted, good, SECRET)).toBe(false);
  });

  it("rejects wrong-length and non-hex signatures without throwing", () => {
    expect(verifyPaystackSignature(body, "abc", SECRET)).toBe(false);
    expect(verifyPaystackSignature(body, "z".repeat(128), SECRET)).toBe(false);
    expect(verifyPaystackSignature(body, "", SECRET)).toBe(false);
    expect(verifyPaystackSignature(body, null, SECRET)).toBe(false);
  });

  it("rejects a signature made with another key", () => {
    expect(
      verifyPaystackSignature(
        body,
        signPaystackPayload(body, "sk_test_other"),
        SECRET
      )
    ).toBe(false);
  });
});

describe("isPaystackIp", () => {
  it("knows Paystack's published IPs", () => {
    expect(isPaystackIp("52.31.139.75")).toBe(true);
    expect(isPaystackIp("::ffff:52.214.14.220")).toBe(true);
    expect(isPaystackIp("1.2.3.4")).toBe(false);
    expect(isPaystackIp(null)).toBe(false);
  });
});

describe("ingestWebhook (PLAN §2.3 #9)", () => {
  it("returns 401 and stores nothing without a valid signature", async () => {
    const res = await ingestWebhook({
      db,
      rawBody: body,
      signature: null,
      secretKey: SECRET,
      encryptionKey: KEY,
    });
    expect(res.status).toBe(401);
    expect(await db.select().from(schema.webhookEvent)).toHaveLength(0);
  });

  it("stores a signed event once and reports duplicates", async () => {
    const signature = signPaystackPayload(body, SECRET);
    const first = await ingestWebhook({
      db,
      rawBody: body,
      signature,
      secretKey: SECRET,
      encryptionKey: KEY,
    });
    const second = await ingestWebhook({
      db,
      rawBody: body,
      signature,
      secretKey: SECRET,
      encryptionKey: KEY,
    });
    expect(first).toMatchObject({ status: 200, duplicate: false });
    expect(second).toMatchObject({ status: 200, duplicate: true });
    if (first.status === 200 && second.status === 200) {
      expect(second.eventId).toBe(first.eventId);
    }
    expect(await db.select().from(schema.webhookEvent)).toHaveLength(1);
  });

  it("returns 400 for a signed body that isn't a Paystack event", async () => {
    const raw = "not json";
    const res = await ingestWebhook({
      db,
      rawBody: raw,
      signature: signPaystackPayload(raw, SECRET),
      secretKey: SECRET,
      encryptionKey: KEY,
    });
    expect(res.status).toBe(400);
  });

  it("enforces the IP allow-list when enabled", async () => {
    const raw = JSON.stringify({
      event: "charge.success",
      data: { reference: "ip" },
    });
    const signature = signPaystackPayload(raw, SECRET);
    const blocked = await ingestWebhook({
      db,
      rawBody: raw,
      signature,
      secretKey: SECRET,
      encryptionKey: KEY,
      ip: "1.2.3.4",
      enforceIpAllowlist: true,
    });
    expect(blocked.status).toBe(401);
    const allowed = await ingestWebhook({
      db,
      rawBody: raw,
      signature,
      secretKey: SECRET,
      encryptionKey: KEY,
      ip: "52.49.173.169",
      enforceIpAllowlist: true,
    });
    expect(allowed.status).toBe(200);
  });
});

describe("dbErrorCause", () => {
  it("keeps the Postgres code, constraint and table, never the values", async () => {
    const { dbErrorCause } = await import("../src/webhook/process");
    const error = Object.assign(
      new Error("Failed query: insert ...\nparams: secret"),
      {
        cause: {
          code: "23503",
          constraint: "audit_log_organization_id_organization_id_fk",
          table: "audit_log",
          detail: "Key (organization_id)=(org_x) is not present",
        },
      }
    );
    expect(dbErrorCause(error)).toEqual({
      code: "23503",
      constraint: "audit_log_organization_id_organization_id_fk",
      table: "audit_log",
    });
    expect(dbErrorCause(new Error("plain"))).toEqual({});
  });
});
