import { schema } from "@workspace/db";
import { createPgTestDb } from "@workspace/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { nextInvoiceNumber } from "../src/invoicing";

// Needs a real Postgres (CI provides one): PGlite has a single connection,
// so it cannot run two issuing transactions at the same time.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("invoice numbers on real Postgres", () => {
  let ctx: Awaited<ReturnType<typeof createPgTestDb>>;
  beforeAll(async () => {
    ctx = await createPgTestDb(url ?? "");
  });
  afterAll(async () => ctx?.close());

  it("are unique and gap-free under concurrent issuers, even with rollbacks", async () => {
    const issuers = 40;
    const results = await Promise.allSettled(
      Array.from({ length: issuers }, (_, i) =>
        ctx.db.transaction(async (tx) => {
          const number = await nextInvoiceNumber(tx, 2026);
          // Hold the lock a moment so issuers really overlap.
          await new Promise((r) => setTimeout(r, 5));
          if (i % 5 === 0) {
            throw new Error("rolled back");
          }
          return number;
        })
      )
    );
    const committed = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value)
      .sort();
    const rolledBack = results.filter((r) => r.status === "rejected");
    expect(rolledBack).toHaveLength(8);
    expect(new Set(committed).size).toBe(committed.length);
    expect(committed).toEqual(
      Array.from(
        { length: issuers - 8 },
        (_, i) => `INV-2026-${String(i + 1).padStart(6, "0")}`
      )
    );
    const [seq] = await ctx.db.select().from(schema.invoiceSequence);
    expect(seq).toEqual({ scope: "INV-2026", lastValue: issuers - 8 });
  });

  it("keeps a separate sequence per year", async () => {
    const number = await ctx.db.transaction((tx) =>
      nextInvoiceNumber(tx, 2027)
    );
    expect(number).toBe("INV-2027-000001");
  });
});
