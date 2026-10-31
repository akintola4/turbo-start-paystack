import { describe, expect, it } from "vitest";

import {
  addInterval,
  catalog,
  getPlanPrice,
  listPlanPrices,
  planPriceId,
} from "../src/catalog";
import { decryptSecret, encryptSecret } from "../src/crypto";
import { formatMoney, TOKENIZATION_AMOUNT } from "../src/money";

const KEY = "a".repeat(64);

describe("money", () => {
  it("formats subunits without losing kobo", () => {
    expect(formatMoney(500_050, "NGN")).toContain("5,000.50");
    expect(formatMoney(1, "USD")).toContain("0.01");
  });

  it("has a tokenisation amount for every currency", () => {
    expect(Object.keys(TOKENIZATION_AMOUNT).sort()).toEqual([
      "GHS",
      "KES",
      "NGN",
      "USD",
      "ZAR",
    ]);
    expect(TOKENIZATION_AMOUNT.NGN).toBe(5000);
  });

  it("charges at least Paystack's minimum transaction amount in each currency", () => {
    // Supported currencies table, https://paystack.com/docs/api/:
    // NGN ₦50.00, GHS ₵0.10, ZAR R1.00, KES Ksh 3.00, USD $2.00.
    const minimum = { NGN: 5000, GHS: 10, ZAR: 100, KES: 300, USD: 200 };
    for (const [currency, amount] of Object.entries(TOKENIZATION_AMOUNT)) {
      expect(amount).toBeGreaterThanOrEqual(
        minimum[currency as keyof typeof minimum]
      );
    }
  });
});

describe("catalog", () => {
  it("has unique price ids and positive integer amounts", () => {
    const prices = listPlanPrices();
    expect(new Set(prices.map((p) => p.id)).size).toBe(prices.length);
    for (const price of prices) {
      expect(Number.isInteger(price.amountSubunit)).toBe(true);
      expect(price.amountSubunit).toBeGreaterThan(0);
    }
  });

  it("keeps the free plan price-less", () => {
    expect(catalog.find((p) => p.key === "free")?.prices).toEqual([]);
  });

  it("looks prices up by id", () => {
    const id = planPriceId("pro", "monthly", "NGN");
    expect(id).toBe("pro-monthly-ngn");
    expect(getPlanPrice(id)?.amountSubunit).toBe(3_000_000);
    expect(getPlanPrice("nope")).toBeUndefined();
  });

  it("adds calendar months", () => {
    const start = new Date("2026-01-15T00:00:00Z");
    expect(addInterval(start, "monthly").toISOString()).toBe(
      "2026-02-15T00:00:00.000Z"
    );
    expect(addInterval(start, "annually").toISOString()).toBe(
      "2027-01-15T00:00:00.000Z"
    );
  });
});

describe("secret encryption", () => {
  it("round-trips", () => {
    const sealed = encryptSecret("AUTH_abc", KEY);
    expect(sealed).not.toContain("AUTH_abc");
    expect(decryptSecret(sealed, KEY)).toBe("AUTH_abc");
  });

  it("rejects a tampered ciphertext", () => {
    const sealed = encryptSecret("AUTH_abc", KEY);
    const parts = sealed.split(":");
    parts[3] = Buffer.from("AUTH_xyz").toString("base64");
    expect(() => decryptSecret(parts.join(":"), KEY)).toThrow();
  });

  it("rejects the wrong key", () => {
    const sealed = encryptSecret("AUTH_abc", KEY);
    expect(() => decryptSecret(sealed, "b".repeat(64))).toThrow();
  });

  it("rejects a truncated GCM tag and malformed ciphertext (audit #14)", () => {
    const sealed = encryptSecret("AUTH_abc", KEY);
    const [version, iv, tag, data] = sealed.split(":");
    const tagBytes = Buffer.from(tag ?? "", "base64");
    expect(tagBytes).toHaveLength(16);
    // Node accepts a 4-byte tag unless the length is enforced.
    const short = tagBytes.subarray(0, 4).toString("base64");
    expect(() =>
      decryptSecret([version, iv, short, data].join(":"), KEY)
    ).toThrow("Unrecognised encrypted value");
    const shortIv = Buffer.alloc(8).toString("base64");
    for (const bad of [
      [version, shortIv, tag, data].join(":"),
      [version, iv, tag, `${data}!!`].join(":"),
      [version, iv, tag, data, "extra"].join(":"),
      [version, iv, tag, ""].join(":"),
      "v1:not:base64:at-all",
      "",
    ]) {
      expect(() => decryptSecret(bad, KEY)).toThrow(
        "Unrecognised encrypted value"
      );
    }
    expect(decryptSecret(sealed, KEY)).toBe("AUTH_abc");
  });
});
